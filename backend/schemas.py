from typing import Optional, List
from datetime import date, time

from pydantic import BaseModel, EmailStr


# ---------- Category & PlanningLevel ----------

class CategoryCreate(BaseModel):
    name: str
    symbol: Optional[str] = None
    color_hex: Optional[str] = None
    description: Optional[str] = None
    godi_item: bool = False


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    symbol: Optional[str] = None
    color_hex: Optional[str] = None
    description: Optional[str] = None
    godi_item: Optional[bool] = None


class CategoryRead(BaseModel):
    id: int
    name: str
    symbol: Optional[str] = None
    color_hex: Optional[str] = None
    description: Optional[str] = None
    godi_item: bool

    class Config:
        orm_mode = True


class PlanningLevelCreate(BaseModel):
    name: str


class PlanningLevelRead(BaseModel):
    id: int
    name: str

    class Config:
        orm_mode = True


# ---------- Events ----------

class EventBase(BaseModel):
    title: str
    parent_id: Optional[int] = None

    start_date: Optional[date] = None
    end_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None

    preacher: Optional[str] = None
    sermon_title: Optional[str] = None
    remarks: Optional[str] = None
    internal_notes: Optional[str] = None
    clarification: Optional[str] = None
    link: Optional[str] = None

    in_klaerung: bool = False
    pco_id: Optional[int] = None
    besucherzahl: Optional[int] = None
    mail: Optional[EmailStr] = None

    attachments: Optional[str] = None
    ort: Optional[str] = None
    link_id: Optional[int] = None


class EventCreate(EventBase):
    # IDs of categories and planning levels to attach
    category_ids: List[int] = []
    planning_level_ids: List[int] = []


class EventRead(EventBase):
    id: int
    categories: List["CategoryRead"] = []
    planning_levels: List["PlanningLevelRead"] = []

    class Config:
        orm_mode = True


class EventUpdate(BaseModel):
    # All optional; only provided fields will be updated
    title: Optional[str] = None
    parent_id: Optional[int] = None

    start_date: Optional[date] = None
    end_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None

    preacher: Optional[str] = None
    sermon_title: Optional[str] = None
    remarks: Optional[str] = None
    internal_notes: Optional[str] = None
    clarification: Optional[str] = None
    link: Optional[str] = None

    in_klaerung: Optional[bool] = None
    pco_id: Optional[int] = None
    besucherzahl: Optional[int] = None
    mail: Optional[EmailStr] = None

    attachments: Optional[str] = None
    ort: Optional[str] = None
    link_id: Optional[int] = None

    # For relations:
    # - None  => leave unchanged
    # - []    => clear all
    # - [ids] => replace with these
    category_ids: Optional[List[int]] = None
    planning_level_ids: Optional[List[int]] = None

class ReportingBase(BaseModel):
    event_id: int
    visitor: int
    vacation: Optional[str] = None
    holiday: Optional[str] = None
    special: Optional[str] = None


class ReportingCreate(ReportingBase):
    # Optional metadata for manual and event-based reporting
    event_title: Optional[str] = None
    event_date: Optional[date] = None
    event_start_time: Optional[time] = None


class ReportingUpdate(BaseModel):
    visitor: Optional[int] = None
    event_title: Optional[str] = None
    event_date: Optional[date] = None
    event_start_time: Optional[time] = None
    vacation: Optional[str] = None
    holiday: Optional[str] = None
    special: Optional[str] = None


class ReportingRead(BaseModel):
    id: int
    event_id: int
    event_title: str
    event_date: Optional[date] = None
    event_start_time: Optional[time] = None
    visitor: Optional[int] = None
    vacation: Optional[str] = None
    holiday: Optional[str] = None
    special: Optional[str] = None

    class Config:
        orm_mode = True




class LoginRequest(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
