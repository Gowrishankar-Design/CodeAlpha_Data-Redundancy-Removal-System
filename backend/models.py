"""
ORM models — Data Redundancy Removal System
=============================================
"""

from sqlalchemy import Column, String, DateTime
from datetime import datetime, timezone

from database import Base


class RecordModel(Base):
    __tablename__ = "records"

    record_id  = Column(String, primary_key=True, index=True)
    name       = Column(String, nullable=False)
    email      = Column(String, nullable=False, index=True)
    department = Column(String, nullable=False)
    phone      = Column(String, default="")
    name_hash  = Column(String, index=True)   # sha256(name|email) — fast exact-duplicate lookup
    timestamp  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "record_id":  self.record_id,
            "name":       self.name,
            "email":      self.email,
            "department": self.department,
            "phone":      self.phone,
            "timestamp":  self.timestamp.isoformat() if self.timestamp else None,
        }
