from datetime import datetime, timezone
import hashlib
import secrets
from typing import TYPE_CHECKING, Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.department import Department
    from app.models.user import User


class ApiKey(Base):
    """
    Cryptographically secure API Key for programmatic third-party integration and bots.
    Hashed using SHA-256 for secure constant-time verification.
    """
    __tablename__ = "api_keys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    hashed_key: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    department_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    department: Mapped[Optional["Department"]] = relationship("Department")
    created_by: Mapped["User"] = relationship("User")

    @classmethod
    def generate_key_pair(cls, name: str, created_by_id: int, department_id: Optional[int] = None):
        """
        Generate a plaintext secret token and a corresponding ApiKey database entity.
        Returns (ApiKey, raw_secret_key).
        Prefix format: nxf_live_<8_char_entropy>
        Raw key format: nxf_live_<32_char_hex>
        """
        random_entropy = secrets.token_hex(16)
        raw_key = f"nxf_live_{random_entropy}"
        prefix = raw_key[:16]
        hashed = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

        entity = cls(
            name=name,
            key_prefix=prefix,
            hashed_key=hashed,
            department_id=department_id,
            created_by_id=created_by_id,
            is_active=True,
        )
        return entity, raw_key

    def verify_key(self, raw_key: str) -> bool:
        """Constant-time SHA-256 hash comparison."""
        hashed = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
        return secrets.compare_digest(self.hashed_key, hashed)

    def __repr__(self) -> str:
        return f"<ApiKey id={self.id} name='{self.name}' prefix='{self.key_prefix}' is_active={self.is_active}>"
