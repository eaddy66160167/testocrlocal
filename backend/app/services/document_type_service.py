import unicodedata

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.errors import AppError
from app.db.models import DocumentType

DEFAULT_TYPES = ("บัตรประชาชนไทย", "Passport ไทย", "เอกสารภาษาอังกฤษ", "อื่น ๆ")


def normalized_name(name):
    return unicodedata.normalize("NFC", name).strip().casefold()


def type_json(record):
    return dict(id=record.id, name=record.name, active=record.active, system=record.system)


def active_type(session, id):
    record = session.get(DocumentType, id)
    if record is None or not record.active:
        raise AppError("ประเภทเอกสารนี้ไม่พร้อมใช้งาน", 422)
    return record


def create_type(session, name):
    name = unicodedata.normalize("NFC", name).strip()
    if not name or len(name) > 100:
        raise AppError("ระบุชื่อประเภทเอกสาร 1–100 ตัวอักษร", 422)
    normalized = normalized_name(name)
    if session.scalar(select(DocumentType).where(DocumentType.normalized_name == normalized)):
        raise AppError("มีชื่อประเภทเอกสารนี้แล้ว", 409)
    record = DocumentType(name=name, normalized_name=normalized)
    session.add(record)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise AppError("มีชื่อประเภทเอกสารนี้แล้ว", 409) from None
    return record
