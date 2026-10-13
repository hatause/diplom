"""Read local lecture attachments without fetching arbitrary URLs."""
import asyncio
import base64
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit
from zipfile import ZipFile, BadZipFile
from xml.etree import ElementTree as ET

from fastapi import HTTPException
from app.core.config import UPLOAD_DIR

MAX_FILE_BYTES = 12 * 1024 * 1024
MAX_TEXT_CHARS = 120000
MAX_XML_BYTES = 20 * 1024 * 1024


def attachment_path(url: str) -> Path:
    parsed = urlsplit(url)
    path = unquote(parsed.path)
    prefix = '/api/v1/uploads/'
    if parsed.scheme or parsed.netloc or not path.startswith(prefix):
        raise HTTPException(400, 'Вложение должно быть загружено на этот сайт.')
    name = path[len(prefix):]
    root = UPLOAD_DIR.resolve()
    target = (root / name).resolve()
    if not name or '/' in name or '\\' in name or target.parent != root:
        raise HTTPException(400, 'Некорректный путь вложения.')
    if not target.is_file():
        raise HTTPException(404, 'Файл лекции не найден. Загрузите его повторно.')
    return target


def _read_attachment(url: str) -> list[dict]:
    path = attachment_path(url)
    if path.stat().st_size > MAX_FILE_BYTES:
        raise HTTPException(413, 'Для AI допустимы файлы до 12 МБ.')
    raw = path.read_bytes()
    if not raw:
        raise HTTPException(422, 'Прикреплённый файл пуст.')
    mime = None
    if raw.startswith(b'%PDF-'):
        mime = 'application/pdf'
    elif raw.startswith(b'\xff\xd8\xff'):
        mime = 'image/jpeg'
    elif raw.startswith(b'\x89PNG\r\n\x1a\n'):
        mime = 'image/png'
    elif raw[:4] == b'RIFF' and raw[8:12] == b'WEBP':
        mime = 'image/webp'
    if mime:
        return [{'type': 'document' if mime == 'application/pdf' else 'image',
                 'mimeType': mime, 'data': base64.b64encode(raw).decode('ascii')}]

    if raw.startswith(b'PK'):
        try:
            with ZipFile(path) as archive:
                names = archive.namelist()
                if 'word/document.xml' in names:
                    members = ['word/document.xml']
                else:
                    members = sorted((n for n in names if re.fullmatch(r'ppt/slides/slide\d+\.xml', n)),
                                     key=lambda n: int(re.search(r'(\d+)\.xml$', n).group(1)))
                if not members:
                    raise HTTPException(415, 'Поддерживаются документы DOCX и презентации PPTX.')
                if sum(archive.getinfo(n).file_size for n in members) > MAX_XML_BYTES:
                    raise HTTPException(413, 'Слишком большой объём текста в документе.')
                chunks = []
                for index, name in enumerate(members):
                    xml = archive.read(name)
                    if b'<!DOCTYPE' in xml or b'<!ENTITY' in xml:
                        raise HTTPException(422, 'Некорректный документ.')
                    tree = ET.fromstring(xml)
                    paragraphs = [' '.join(t.text or '' for t in p.iter() if t.tag.rsplit('}', 1)[-1] == 't')
                                  for p in tree.iter() if p.tag.rsplit('}', 1)[-1] == 'p']
                    text = '\n'.join(p for p in paragraphs if p.strip())
                    if text.strip():
                        chunks.append((f'Слайд {index + 1}\n' if name.startswith('ppt/') else '') + text)
                text = '\n\n'.join(chunks)
        except (BadZipFile, ET.ParseError, KeyError, RuntimeError, OSError):
            raise HTTPException(422, 'Не удалось прочитать документ. Загрузите исправный DOCX, PPTX или PDF.') from None
    elif path.suffix.lower() in ('.txt', '.md', '.csv'):
        try:
            text = raw.decode('utf-8-sig')
        except UnicodeDecodeError:
            try:
                text = raw.decode('cp1251')
            except UnicodeDecodeError:
                raise HTTPException(422, 'Сохраните текстовый файл в UTF-8.') from None
    else:
        raise HTTPException(415, 'Формат не поддерживается для AI. Используйте PDF, DOCX, PPTX, TXT, MD, JPEG, PNG или WebP. Старый PPT сохраните как PPTX или PDF.')
    if not text.strip():
        raise HTTPException(422, 'В файле нет доступного текста. Сохраните его как PDF для распознавания.')
    if len(text) > MAX_TEXT_CHARS:
        raise HTTPException(413, 'Лекция слишком длинная. Разделите её на несколько файлов.')
    return [{'type': 'text', 'text': text}]


async def read_attachment(url: str) -> list[dict]:
    return await asyncio.to_thread(_read_attachment, url)


async def lecture_material(lecture) -> list[dict]:
    blocks = []
    if lecture.content and lecture.content.strip():
        blocks.append({'type': 'text', 'text': lecture.content.strip()})
    if lecture.fileUrl:
        blocks.extend(await read_attachment(lecture.fileUrl))
    if not blocks:
        raise HTTPException(422, 'Добавьте текст лекции или прикрепите файл.')
    return blocks
