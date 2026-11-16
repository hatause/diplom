"""Keep local development origins out of production credentialed requests."""

from app.core.config import Settings


def cors_options(settings: Settings) -> dict:
    origins = list(dict.fromkeys(origin.strip() for origin in settings.CORS_ORIGIN.split(',') if origin.strip()))
    local_regex = None
    if settings.NODE_ENV.lower() != 'production':
        for port in (5173, 3000, 4000):
            for host in ('localhost', '127.0.0.1'):
                origin = f'http://{host}:{port}'
                if origin not in origins:
                    origins.append(origin)
        local_regex = r'https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?'
    return dict(allow_origins=origins, allow_origin_regex=local_regex,
                allow_credentials=True, allow_methods=['*'], allow_headers=['*'])
