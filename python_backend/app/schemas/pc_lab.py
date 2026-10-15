from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

Part = Literal['part-cpu', 'part-gpu', 'part-mobo', 'part-ram', 'part-ssd', 'part-psu', 'part-cooler', 'pc-case']
Slot = Literal['part-psu', 'part-mobo', 'part-cpu', 'part-ram', 'part-ssd', 'part-cooler', 'part-gpu', 'case-glass-panel']
Fault = Literal['TPM_BYPASS', 'INTEL_VMD_DRIVER', 'MBR_TO_GPT_DISKPART', 'OOBE_BYPASSNRO']

class LabResume(BaseModel):
    model_config = ConfigDict(extra='forbid')
    language: Literal['ru-RU', 'en-US'] = 'ru-RU'
    region: Literal['KZ', 'RU'] = 'KZ'
    keyboard: Literal['ru', 'us'] = 'ru'
    mode: Literal['partlab', 'explore', 'builder', 'bios', 'windows'] = 'partlab'
    installed: list[Slot] = Field(default_factory=list, max_length=8)
    win_step: int = Field(default=1, ge=1, le=5, strict=True)
    edition: Literal['Windows 11 Pro (x64)', 'Windows 11 Education (x64)', 'Windows 11 Home (x64)'] = 'Windows 11 Pro (x64)'
    faults: list[Fault] = Field(default_factory=lambda: ['TPM_BYPASS', 'INTEL_VMD_DRIVER', 'MBR_TO_GPT_DISKPART', 'OOBE_BYPASSNRO'], max_length=4)
    drivers: list[Literal['chipset', 'gpu', 'network']] = Field(default_factory=list, max_length=3)

class ProgressUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    revision: int | None = Field(default=None, ge=0, strict=True)
    inspected_parts: list[Part] | None = Field(default=None, max_length=8)
    assembly_completed: bool | None = None
    assembly_mistakes: int | None = Field(default=None, ge=0, le=10000, strict=True)
    bios_flashed: bool | None = None
    windows_installed: bool | None = None
    resolved_faults: list[Fault] | None = Field(default=None, max_length=4)
    system_drive_gb: int | None = Field(default=None, ge=100, le=450, strict=True)
    resume: LabResume | None = None
