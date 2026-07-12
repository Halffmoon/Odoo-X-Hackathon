"""Import all models so Alembic's autogenerate sees the full metadata."""

from app.database import Base
from app.models.allocation import AllocationHistory, AssetAllocation
from app.models.asset import (
    Asset,
    AssetAttachment,
    AssetCustomFieldValue,
    AssetStatusHistory,
)
from app.models.audit import (
    AuditAssignment,
    AuditCycle,
    AuditDiscrepancy,
    AuditResult,
)
from app.models.booking import Booking, BookingHistory
from app.models.category import AssetCategory, CategoryCustomField
from app.models.department import Department
from app.models.employee import Employee, Role, RoleAssignmentHistory
from app.models.location import Location
from app.models.maintenance import MaintenanceHistory, MaintenanceRequest
from app.models.notification import ActivityLog, Notification
from app.models.transfer import AssetTransfer
from app.models.user import PasswordResetToken, RefreshToken, User

__all__ = [
    "Base",
    "AllocationHistory",
    "AssetAllocation",
    "Asset",
    "AssetAttachment",
    "AssetCustomFieldValue",
    "AssetStatusHistory",
    "AuditAssignment",
    "AuditCycle",
    "AuditDiscrepancy",
    "AuditResult",
    "Booking",
    "BookingHistory",
    "AssetCategory",
    "CategoryCustomField",
    "Department",
    "Employee",
    "Role",
    "RoleAssignmentHistory",
    "Location",
    "MaintenanceHistory",
    "MaintenanceRequest",
    "ActivityLog",
    "Notification",
    "AssetTransfer",
    "PasswordResetToken",
    "RefreshToken",
    "User",
]
