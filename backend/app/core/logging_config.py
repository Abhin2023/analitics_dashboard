import logging
import logging.handlers
from pathlib import Path

LOGS_DIR = Path(__file__).resolve().parent.parent.parent / "logs"
BACKEND_LOG_FILE = LOGS_DIR / "backend.log"
FRONTEND_LOG_FILE = LOGS_DIR / "frontend.log"

_configured = False


def setup_logging() -> None:
    """Write every backend log line (app code, uvicorn access/error logs,
    unhandled exception tracebacks) to logs/backend.log in addition to the
    console, so errors can be found after the terminal scrollback is gone.
    """
    global _configured
    if _configured:
        return
    _configured = True

    LOGS_DIR.mkdir(parents=True, exist_ok=True)

    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s", "%Y-%m-%d %H:%M:%S"
    )
    file_handler = logging.handlers.RotatingFileHandler(
        BACKEND_LOG_FILE, maxBytes=10 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)

    root_logger = logging.getLogger()
    root_logger.addHandler(file_handler)
    root_logger.setLevel(logging.INFO)

    # uvicorn configures its own loggers with propagate=False by default in
    # some versions, so attach the file handler directly to make sure
    # request/access/error lines land in the file too.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logging.getLogger(name).addHandler(file_handler)


def get_frontend_logger() -> logging.Logger:
    """Separate logger/file for errors reported by the browser frontend,
    kept apart from backend.log so the two are easy to tell apart."""
    logger = logging.getLogger("frontend")
    if not logger.handlers:
        LOGS_DIR.mkdir(parents=True, exist_ok=True)
        formatter = logging.Formatter(
            "%(asctime)s [%(levelname)s] %(message)s", "%Y-%m-%d %H:%M:%S"
        )
        file_handler = logging.handlers.RotatingFileHandler(
            FRONTEND_LOG_FILE, maxBytes=10 * 1024 * 1024, backupCount=3, encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger
