"""Request validation models (pydantic).

Models for STUDENT and MENU allow extra fields because those two tables
may contain columns that were not listed in the project notes. Extra
fields are only used if a column with that exact name really exists
(checked against USER_TAB_COLUMNS) - anything else is ignored.
"""
import re
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

MealType = Literal["Breakfast", "Lunch", "Dinner", "Snack"]
PaymentStatus = Literal["Paid", "Pending", "Failed"]
Severity = Literal["Low", "Medium", "High"]
MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Flexible(BaseModel):
    model_config = ConfigDict(extra="allow", str_strip_whitespace=True)


# ---------- auth ----------
class LoginIn(Strict):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=72)


class ChangePasswordIn(Strict):
    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=6, max_length=72)


# ---------- students ----------
PHONE_RE = re.compile(r"^[0-9+\-() ]{6,15}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class StudentBase(Flexible):
    student_name: Optional[str] = Field(default=None, min_length=2, max_length=50)
    room_no: Optional[str] = Field(default=None, max_length=10)
    phone: Optional[str] = Field(default=None, max_length=15)
    gender: Optional[str] = Field(default=None, max_length=20)
    hostel_name: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=100)
    status: Optional[str] = Field(default=None, max_length=15)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        if v and not PHONE_RE.match(v):
            raise ValueError("Phone must be 6-15 digits (may include + - spaces).")
        return v or None

    @field_validator("email")
    @classmethod
    def _email(cls, v):
        if v and not EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address.")
        return v or None


class StudentCreate(StudentBase):
    student_id: Optional[int] = Field(default=None, gt=0, description="Leave empty to auto-generate")
    student_name: str = Field(min_length=2, max_length=50)


class StudentUpdate(StudentBase):
    pass


# ---------- menus ----------
class MenuCreate(Flexible):
    menu_id: Optional[int] = Field(default=None, gt=0)
    menu_date: date


class MenuUpdate(Flexible):
    menu_date: Optional[date] = None


# ---------- food items ----------
class FoodItemCreate(Strict):
    food_id: Optional[int] = Field(default=None, gt=0)
    food_name: str = Field(min_length=2, max_length=50)
    category: str = Field(min_length=2, max_length=20)
    calories: Optional[float] = Field(default=None, ge=0, le=5000)
    availability: Optional[str] = Field(default="Available", max_length=15)


class FoodItemUpdate(Strict):
    food_name: Optional[str] = Field(default=None, min_length=2, max_length=50)
    category: Optional[str] = Field(default=None, min_length=2, max_length=20)
    calories: Optional[float] = Field(default=None, ge=0, le=5000)
    availability: Optional[str] = Field(default=None, max_length=15)


# ---------- menu items ----------
class MenuItemCreate(Strict):
    menu_id: int = Field(gt=0)
    food_id: int = Field(gt=0)
    meal_type: MealType
    quantity_planned: Optional[float] = Field(default=None, ge=0, le=999999)


class MenuItemUpdate(Strict):
    menu_id: Optional[int] = Field(default=None, gt=0)
    food_id: Optional[int] = Field(default=None, gt=0)
    meal_type: Optional[MealType] = None
    quantity_planned: Optional[float] = Field(default=None, ge=0, le=999999)


# ---------- attendance ----------
class AttendanceCreate(Strict):
    student_id: int = Field(gt=0)
    menu_id: int = Field(gt=0)
    meal_type: MealType
    status: Literal["Present", "Absent"] = "Present"
    attendance_time: Optional[datetime] = None


class AttendanceUpdate(Strict):
    student_id: Optional[int] = Field(default=None, gt=0)
    menu_id: Optional[int] = Field(default=None, gt=0)
    meal_type: Optional[MealType] = None
    status: Optional[Literal["Present", "Absent"]] = None
    attendance_time: Optional[datetime] = None


# ---------- payments ----------
class PaymentCreate(Strict):
    student_id: int = Field(gt=0)
    payment_month: str = Field(min_length=3, max_length=20, examples=["November 2026"])
    amount: float = Field(gt=0, le=99999999)

    @field_validator("payment_month")
    @classmethod
    def _month(cls, v: str):
        parts = v.split()
        if len(parts) != 2 or parts[0].capitalize() not in MONTHS or not re.fullmatch(r"\d{4}", parts[1]):
            raise ValueError("Use the format 'Month YYYY', e.g. 'November 2026'.")
        return f"{parts[0].capitalize()} {parts[1]}"


class PaymentStatusUpdate(Strict):
    payment_status: PaymentStatus


# ---------- complaints ----------
class ComplaintCreate(Strict):
    student_id: Optional[int] = Field(default=None, gt=0, description="Ignored for student logins")
    menu_id: Optional[int] = Field(default=None, gt=0)
    complaint_type: str = Field(min_length=2, max_length=30)
    description: str = Field(min_length=5, max_length=200)
    severity: Severity = "Medium"


class ComplaintStatusUpdate(Strict):
    status: Literal["Open", "In Progress"]


# ---------- wastage ----------
class WastageCreate(Strict):
    menu_item_id: int = Field(gt=0)
    quantity_wasted: float = Field(ge=0, le=999999)
    wastage_date: Optional[date] = None
    reason: Optional[str] = Field(default=None, max_length=200)


class WastageUpdate(Strict):
    menu_item_id: Optional[int] = Field(default=None, gt=0)
    quantity_wasted: Optional[float] = Field(default=None, ge=0, le=999999)
    wastage_date: Optional[date] = None
    reason: Optional[str] = Field(default=None, max_length=200)
