from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, date, timedelta
from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Initial doctors list (will be dynamic)
INITIAL_DOCTORS = [
    "DR SEFA ARAS",
    "DR MURATCAN KARBA",
    "DR HÜSEYİN EKİNCİ",
    "DR NAZİF YELKEN"
]

VISIT_TYPES = ["implant", "kontrol", "muayene"]
PATIENT_STATUS = ["kabul etti", "kabul etmedi", "düşünüyor"]


# Define Models
class DoctorModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone_number: Optional[str] = ""
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Patient(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    visit_date: str  # ISO date string YYYY-MM-DD
    patient_name: str
    phone_number: Optional[str] = ""
    doctor: str
    visit_type: str
    status: str  # "kabul etti", "kabul etmedi", "düşünüyor"
    accepted: bool  # Derived from status for backward compatibility
    family_group: Optional[str] = ""  # Aile Grubu
    profession_group: Optional[str] = ""  # Meslek Grubu
    is_revisit: bool = False  # Tekrar görüşme
    revisit_date: Optional[str] = ""  # Tekrar görüşme tarihi
    notes: Optional[str] = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PatientCreate(BaseModel):
    visit_date: str
    patient_name: str
    phone_number: Optional[str] = ""
    doctor: str
    visit_type: str
    status: str  # "kabul etti", "kabul etmedi", "düşünüyor"
    family_group: Optional[str] = ""
    profession_group: Optional[str] = ""
    is_revisit: bool = False
    revisit_date: Optional[str] = ""
    notes: Optional[str] = ""


class FollowUp(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    patient_name: str
    phone_number: Optional[str] = ""
    doctor: str
    followup_date: str  # ISO date string YYYY-MM-DD
    patient_status: str  # "kabul etti", "kabul etmedi", "düşünüyor"
    followup_status: str = "beklemede"  # "beklemede", "gecikmiş", "tamamlandı"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FollowUpCreate(BaseModel):
    patient_id: str
    followup_date: str
    reason: str
    status: str = "beklemede"


class WhatsAppMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    message_type: str  # "followup_reminder" or "daily_summary"
    recipient_name: str
    recipient_phone: str
    message_text: str
    scheduled_date: str  # ISO date string
    status: str = "onay_bekliyor"  # "onay_bekliyor", "gönderildi", "başarısız"
    approved: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DoctorInfo(BaseModel):
    doctor_name: str
    phone_number: str


class DoctorStats(BaseModel):
    doctor: str
    total_examinations: int
    accepted_count: int
    acceptance_rate: float


class FamilyStats(BaseModel):
    family_group: str
    patient_count: int
    accepted_count: int
    acceptance_rate: float


class ProfessionStats(BaseModel):
    profession_group: str
    patient_count: int
    accepted_count: int
    acceptance_rate: float


class MonthlyStats(BaseModel):
    total_patients: int
    implant_count: int
    checkup_count: int
    examination_count: int
    revisit_count: int  # Tekrar görüşmeler
    doctor_stats: List[DoctorStats]
    family_stats: List[FamilyStats]
    profession_stats: List[ProfessionStats]
    total_families: int
    month: int
    year: int


# Routes
@api_router.get("/")
async def root():
    return {"message": "Esdent Gold Diş Kliniği Yönetim Sistemi"}


@api_router.on_event("startup")
async def initialize_doctors():
    """Initialize doctors collection if empty"""
    count = await db.doctors.count_documents({})
    if count == 0:
        for doctor_name in INITIAL_DOCTORS:
            doc = DoctorModel(name=doctor_name, active=True)
            doc_dict = doc.model_dump()
            doc_dict['created_at'] = doc_dict['created_at'].isoformat()
            await db.doctors.insert_one(doc_dict)


@api_router.get("/doctors")
async def get_doctors(active_only: bool = True):
    """Get all doctors"""
    query = {"active": True} if active_only else {}
    doctors = await db.doctors.find(query, {"_id": 0}).sort("name", 1).to_list(100)
    return {"doctors": [d['name'] for d in doctors]}


@api_router.post("/doctors")
async def create_doctor(name: str, phone_number: str = ""):
    """Add new doctor"""
    # Check if exists
    existing = await db.doctors.find_one({"name": name})
    if existing:
        raise HTTPException(status_code=400, detail="Bu doktor zaten mevcut")
    
    doctor = DoctorModel(name=name, phone_number=phone_number, active=True)
    doc = doctor.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.doctors.insert_one(doc)
    
    return {"message": "Doktor eklendi", "doctor": doctor}


@api_router.put("/doctors/{doctor_id}")
async def update_doctor(doctor_id: str, name: str, phone_number: str = ""):
    """Update doctor"""
    result = await db.doctors.update_one(
        {"id": doctor_id},
        {"$set": {"name": name, "phone_number": phone_number}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Doktor bulunamadı")
    
    return {"message": "Doktor güncellendi"}


@api_router.delete("/doctors/{doctor_id}")
async def delete_doctor(doctor_id: str):
    """Soft delete doctor (mark as inactive)"""
    result = await db.doctors.update_one(
        {"id": doctor_id},
        {"$set": {"active": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Doktor bulunamadı")
    
    return {"message": "Doktor silindi"}



@api_router.put("/doctors/{doctor_id}/activate")
async def activate_doctor(doctor_id: str):
    """Activate a previously deactivated doctor"""
    # Check if doctor exists
    doctor = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doktor bulunamadı")
    
    # Activate the doctor
    result = await db.doctors.update_one(
        {"id": doctor_id},
        {"$set": {"active": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Doktor bulunamadı")
    
    return {"message": "Doktor aktif hale getirildi"}


@api_router.get("/doctors/all")
async def get_all_doctors_with_details():
    """Get all doctors with full details for management"""
    doctors = await db.doctors.find({}, {"_id": 0}).sort("name", 1).to_list(100)
    return {"doctors": doctors}


@api_router.get("/visit-types")
async def get_visit_types():
    return {"visit_types": VISIT_TYPES}


@api_router.get("/patient-status-options")
async def get_patient_status_options():
    return {"status_options": PATIENT_STATUS}


@api_router.get("/patients/overdue")
async def get_overdue_patients():
    """Get all overdue patients (gecikmiş hastalar)"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get all pending followups with past dates
    followups = await db.followups.find(
        {
            "followup_status": {"$in": ["beklemede", "gecikmiş"]},
            "followup_date": {"$lt": today}
        },
        {"_id": 0}
    ).to_list(1000)
    
    # Update status to "gecikmiş" automatically
    for followup in followups:
        if followup.get('followup_status') == 'beklemede':
            await db.followups.update_one(
                {"id": followup['id']},
                {"$set": {"followup_status": "gecikmiş"}}
            )
            followup['followup_status'] = 'gecikmiş'
    
    return {
        "total": len(followups),
        "overdue_patients": followups
    }


# Doctor Info Management
@api_router.post("/doctor-info")
async def save_doctor_info(doctor_info: DoctorInfo):
    doc = doctor_info.model_dump()
    await db.doctor_info.update_one(
        {"doctor_name": doctor_info.doctor_name},
        {"$set": doc},
        upsert=True
    )
    return {"message": "Doktor bilgisi kaydedildi"}


@api_router.get("/doctor-info")
async def get_doctor_info():
    doctors_info = await db.doctor_info.find({}, {"_id": 0}).to_list(100)
    return doctors_info


# Patient Management
@api_router.post("/patients", response_model=Patient)
async def create_patient(input: PatientCreate):
    # Validate visit_type and status
    if input.visit_type not in VISIT_TYPES:
        raise HTTPException(status_code=400, detail="Geçersiz ziyaret tipi")
    
    if input.status not in PATIENT_STATUS:
        raise HTTPException(status_code=400, detail="Geçersiz hasta durumu")
    
    patient_dict = input.model_dump()
    # Set accepted based on status
    patient_dict['accepted'] = (input.status == "kabul etti")
    patient_obj = Patient(**patient_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = patient_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    _ = await db.patients.insert_one(doc)
    
    # Auto-create follow-up if status is "düşünüyor"
    if input.status == "düşünüyor" and not input.is_revisit:
        visit_date = datetime.fromisoformat(input.visit_date)
        followup_date = (visit_date + timedelta(days=7)).strftime("%Y-%m-%d")
        
        followup = FollowUp(
            patient_id=patient_obj.id,
            patient_name=input.patient_name,
            phone_number=input.phone_number or "",
            doctor=input.doctor,
            followup_date=followup_date,
            patient_status=input.status,
            followup_status="beklemede"
        )
        
        followup_doc = followup.model_dump()
        followup_doc['created_at'] = followup_doc['created_at'].isoformat()
        await db.followups.insert_one(followup_doc)
        
        # Create WhatsApp reminder message (pending approval)
        if input.phone_number:
            message_text = f"Merhaba {input.patient_name}, geçen hafta görüştüğümüz tedavi planı hakkında nazik bir hatırlatma yapmak istedik. Karar verebildiniz mi? İsterseniz tekrar bilgi verebiliriz."
            
            whatsapp_msg = WhatsAppMessage(
                message_type="followup_reminder",
                recipient_name=input.patient_name,
                recipient_phone=input.phone_number,
                message_text=message_text,
                scheduled_date=followup_date,
                status="onay_bekliyor",
                approved=False
            )
            
            msg_doc = whatsapp_msg.model_dump()
            msg_doc['created_at'] = msg_doc['created_at'].isoformat()
            await db.whatsapp_messages.insert_one(msg_doc)
    
    return patient_obj


@api_router.put("/patients/{patient_id}")
async def update_patient(patient_id: str, input: PatientCreate):
    """Update existing patient"""
    print(f"UPDATE PATIENT: ID={patient_id}, Status={input.status}, Name={input.patient_name}")
    
    # Validate visit_type and status
    if input.visit_type not in VISIT_TYPES:
        raise HTTPException(status_code=400, detail="Geçersiz ziyaret tipi")
    
    if input.status not in PATIENT_STATUS:
        raise HTTPException(status_code=400, detail="Geçersiz hasta durumu")
    
    # Check if patient exists
    existing_patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not existing_patient:
        raise HTTPException(status_code=404, detail="Hasta bulunamadı")
    
    # Prepare update data
    update_data = input.model_dump()
    update_data['accepted'] = (input.status == "kabul etti")
    
    # Update patient
    result = await db.patients.update_one(
        {"id": patient_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Hasta bulunamadı")
    
    # Handle follow-up logic
    # If status changed to "düşünüyor", create follow-up if doesn't exist
    if input.status == "düşünüyor" and not input.is_revisit:
        existing_followup = await db.followups.find_one({"patient_id": patient_id})
        if not existing_followup:
            visit_date = datetime.fromisoformat(input.visit_date)
            followup_date = (visit_date + timedelta(days=7)).strftime("%Y-%m-%d")
            
            followup = FollowUp(
                patient_id=patient_id,
                patient_name=input.patient_name,
                phone_number=input.phone_number or "",
                doctor=input.doctor,
                followup_date=followup_date,
                patient_status=input.status,
                followup_status="beklemede"
            )
            
            followup_doc = followup.model_dump()
            followup_doc['created_at'] = followup_doc['created_at'].isoformat()
            await db.followups.insert_one(followup_doc)
    
    # If status changed from "düşünüyor" to something else, remove follow-up
    if existing_patient.get('status') == 'düşünüyor' and input.status != 'düşünüyor':
        await db.followups.delete_many({"patient_id": patient_id})
    
    return {"message": "Hasta bilgileri güncellendi"}


@api_router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str):
    """Delete patient and related follow-ups"""
    # Check if patient exists
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Hasta bulunamadı")
    
    # Delete patient
    result = await db.patients.delete_one({"id": patient_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Hasta bulunamadı")
    
    # Delete related follow-ups
    await db.followups.delete_many({"patient_id": patient_id})
    
    # Delete related WhatsApp messages
    await db.whatsapp_messages.delete_many({"recipient_name": patient['patient_name']})
    
    return {"message": "Hasta silindi"}



@api_router.get("/patients", response_model=List[Patient])
async def get_patients(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    doctor: Optional[str] = None,
    family_group: Optional[str] = None,
    profession_group: Optional[str] = None
):
    query = {}
    
    # Filter by date range
    if start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        query["visit_date"] = date_filter
    
    # Filter by doctor
    if doctor:
        query["doctor"] = doctor
    
    # Filter by family group
    if family_group:
        query["family_group"] = family_group
    
    # Filter by profession group
    if profession_group:
        query["profession_group"] = profession_group
    
    patients = await db.patients.find(query, {"_id": 0}).sort("visit_date", -1).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects and handle missing status field
    for patient in patients:
        if isinstance(patient['created_at'], str):
            patient['created_at'] = datetime.fromisoformat(patient['created_at'])
        
        # Handle missing status field for backward compatibility
        if 'status' not in patient:
            if patient.get('accepted', False):
                patient['status'] = 'kabul etti'
            else:
                patient['status'] = 'kabul etmedi'
        
        # Handle missing status field for backward compatibility
        if 'status' not in patient:
            if patient.get('accepted', False):
                patient['status'] = 'kabul etti'
            else:
                patient['status'] = 'kabul etmedi'
    
    return patients


@api_router.get("/patients/daily")
async def get_daily_patients(date: str):
    """Get all patients for a specific date"""
    patients = await db.patients.find(
        {"visit_date": date},
        {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects and handle missing status field
    for patient in patients:
        if isinstance(patient['created_at'], str):
            patient['created_at'] = datetime.fromisoformat(patient['created_at'])
        
        # Handle missing status field for backward compatibility
        if 'status' not in patient:
            if patient.get('accepted', False):
                patient['status'] = 'kabul etti'
            else:
                patient['status'] = 'kabul etmedi'
        
        # Handle missing status field for backward compatibility
        if 'status' not in patient:
            if patient.get('accepted', False):
                patient['status'] = 'kabul etti'
            else:
                patient['status'] = 'kabul etmedi'
    
    return {"date": date, "patients": patients}


@api_router.get("/patients/accepted")
async def get_accepted_patients(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None
):
    """Get all accepted patients"""
    query = {
        "status": "kabul etti",  # Only patients who accepted
        "visit_type": {"$in": ["implant", "kontrol", "muayene"]}  # Only count these three visit types
    }
    
    # Date filtering
    if month and year:
        start_date = f"{year}-{month:02d}-01"
        if month == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{month + 1:02d}-01"
        query["visit_date"] = {"$gte": start_date, "$lt": end_date}
    elif start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        query["visit_date"] = date_filter
    
    patients = await db.patients.find(query, {"_id": 0}).sort("visit_date", -1).to_list(1000)
    
    for patient in patients:
        if isinstance(patient['created_at'], str):
            patient['created_at'] = datetime.fromisoformat(patient['created_at'])
        
        # Handle missing status field for backward compatibility
        if 'status' not in patient:
            if patient.get('accepted', False):
                patient['status'] = 'kabul etti'
            else:
                patient['status'] = 'kabul etmedi'
    
    # Calculate statistics
    implant = sum(1 for p in patients if p['visit_type'] == 'implant')
    kontrol = sum(1 for p in patients if p['visit_type'] == 'kontrol')
    muayene = sum(1 for p in patients if p['visit_type'] == 'muayene')
    total = implant + kontrol + muayene  # Total is sum of these three categories
    
    # Doctor stats
    doctor_stats = {}
    # Get active doctors dynamically
    active_doctors = await db.doctors.find({"active": True}, {"_id": 0}).to_list(100)
    doctor_names = [d['name'] for d in active_doctors]
    
    for doctor in doctor_names:
        doc_patients = [p for p in patients if p['doctor'] == doctor]
        doctor_stats[doctor] = len(doc_patients)
    
    return {
        "total": total,
        "patients": patients,
        "stats": {
            "implant": implant,
            "kontrol": kontrol,
            "muayene": muayene,
            "doctor_stats": doctor_stats
        }
    }


@api_router.get("/patients/not-accepted")
async def get_not_accepted_patients(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None
):
    """Get all not accepted patients (kabul edilmedi) - excluding 'düşünüyor'"""
    query = {
        "status": "kabul etmedi",  # Only patients who explicitly rejected, not thinking
        "visit_type": {"$in": ["implant", "kontrol", "muayene"]}  # Only count these three visit types
    }
    
    # Date filtering
    if month and year:
        start_date = f"{year}-{month:02d}-01"
        if month == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{month + 1:02d}-01"
        query["visit_date"] = {"$gte": start_date, "$lt": end_date}
    elif start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        query["visit_date"] = date_filter
    
    patients = await db.patients.find(query, {"_id": 0}).sort("visit_date", -1).to_list(1000)
    
    for patient in patients:
        if isinstance(patient['created_at'], str):
            patient['created_at'] = datetime.fromisoformat(patient['created_at'])
        
        # Handle missing status field for backward compatibility
        if 'status' not in patient:
            if patient.get('accepted', False):
                patient['status'] = 'kabul etti'
            else:
                patient['status'] = 'kabul etmedi'
    
    # Calculate statistics
    implant = sum(1 for p in patients if p['visit_type'] == 'implant')
    kontrol = sum(1 for p in patients if p['visit_type'] == 'kontrol')
    muayene = sum(1 for p in patients if p['visit_type'] == 'muayene')
    total = implant + kontrol + muayene  # Total is sum of these three categories
    
    # Doctor stats
    doctor_stats = {}
    # Get active doctors dynamically
    active_doctors = await db.doctors.find({"active": True}, {"_id": 0}).to_list(100)
    doctor_names = [d['name'] for d in active_doctors]
    
    for doctor in doctor_names:
        doc_patients = [p for p in patients if p['doctor'] == doctor]
        doctor_stats[doctor] = len(doc_patients)
    
    return {
        "total": total,
        "patients": patients,
        "stats": {
            "implant": implant,
            "kontrol": kontrol,
            "muayene": muayene,
            "doctor_stats": doctor_stats
        }
    }


@api_router.get("/patients/thinking")
async def get_thinking_patients(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None
):
    """Get all thinking patients (düşünüyor)"""
    query = {
        "status": "düşünüyor",  # Only patients who are thinking
        "visit_type": {"$in": ["implant", "kontrol", "muayene"]}  # Only count these three visit types
    }
    
    # Date filtering
    if month and year:
        start_date = f"{year}-{month:02d}-01"
        if month == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{month + 1:02d}-01"
        query["visit_date"] = {"$gte": start_date, "$lt": end_date}
    elif start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        query["visit_date"] = date_filter
    
    # Get all patients with "düşünüyor" status
    thinking_patients = await db.patients.find(query, {"_id": 0}).sort("visit_date", -1).to_list(1000)
    
    for patient in thinking_patients:
        if isinstance(patient['created_at'], str):
            patient['created_at'] = datetime.fromisoformat(patient['created_at'])
    
    # Calculate statistics
    implant = sum(1 for p in thinking_patients if p['visit_type'] == 'implant')
    kontrol = sum(1 for p in thinking_patients if p['visit_type'] == 'kontrol')
    muayene = sum(1 for p in thinking_patients if p['visit_type'] == 'muayene')
    total = implant + kontrol + muayene  # Total is sum of these three categories
    
    # Doctor stats
    doctor_stats = {}
    # Get active doctors dynamically
    active_doctors = await db.doctors.find({"active": True}, {"_id": 0}).to_list(100)
    doctor_names = [d['name'] for d in active_doctors]
    
    for doctor in doctor_names:
        doc_patients = [p for p in thinking_patients if p['doctor'] == doctor]
        doctor_stats[doctor] = len(doc_patients)
    
    return {
        "total": total,
        "patients": thinking_patients,
        "stats": {
            "implant": implant,
            "kontrol": kontrol,
            "muayene": muayene,
            "doctor_stats": doctor_stats
        }
    }


@api_router.post("/patients/{patient_id}/send-reminder")
async def send_reminder_to_patient(patient_id: str):
    """Create WhatsApp reminder message for thinking patient"""
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Hasta bulunamadı")
    
    if not patient.get('phone_number'):
        raise HTTPException(status_code=400, detail="Hasta telefon numarası bulunamadı")
    
    # Create WhatsApp message
    message_text = f"Merhaba {patient['patient_name']}, geçen hafta görüştüğümüz tedavi ile ilgili nazik bir hatırlatma yapmak istedik. Karar verebildiniz mi? İsterseniz tekrar bilgi verebiliriz."
    
    whatsapp_msg = WhatsAppMessage(
        message_type="followup_reminder",
        recipient_name=patient['patient_name'],
        recipient_phone=patient['phone_number'],
        message_text=message_text,
        scheduled_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        status="onay_bekliyor",
        approved=False
    )
    
    msg_doc = whatsapp_msg.model_dump()
    msg_doc['created_at'] = msg_doc['created_at'].isoformat()
    await db.whatsapp_messages.insert_one(msg_doc)
    
    return {"message": "Hatırlatma mesajı oluşturuldu", "whatsapp_message": whatsapp_msg}


@api_router.patch("/patients/{patient_id}/revisit")
async def mark_as_revisit(patient_id: str, revisit_date: str):
    """Mark patient as revisit"""
    result = await db.patients.update_one(
        {"id": patient_id},
        {"$set": {"is_revisit": True, "revisit_date": revisit_date}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Hasta bulunamadı")
    
    return {"message": "Hasta tekrar görüşme olarak işaretlendi"}


@api_router.get("/family-groups")
async def get_family_groups():
    """Get all unique family groups"""
    families = await db.patients.distinct("family_group")
    families = [f for f in families if f]  # Remove empty strings
    return {"family_groups": sorted(families)}


@api_router.get("/profession-groups")
async def get_profession_groups():
    """Get all unique profession groups"""
    professions = await db.patients.distinct("profession_group")
    professions = [p for p in professions if p]  # Remove empty strings
    return {"profession_groups": sorted(professions)}


# Follow-up Management
@api_router.post("/followups", response_model=FollowUp)
async def create_followup(input: FollowUpCreate):
    # Get patient info
    patient = await db.patients.find_one({"id": input.patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Hasta bulunamadı")
    
    followup = FollowUp(
        patient_id=input.patient_id,
        patient_name=patient['patient_name'],
        phone_number=patient.get('phone_number', ''),
        doctor=patient['doctor'],
        followup_date=input.followup_date,
        patient_status=patient.get('status', 'düşünüyor'),
        followup_status=input.status
    )
    
    doc = followup.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.followups.insert_one(doc)
    return followup


@api_router.get("/followups", response_model=List[FollowUp])
async def get_followups(
    status: Optional[str] = None,
    doctor: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    query = {}
    
    if status:
        query["status"] = status
    
    if doctor:
        query["doctor"] = doctor
    
    if start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        query["followup_date"] = date_filter
    
    followups = await db.followups.find(query, {"_id": 0}).sort("followup_date", 1).to_list(1000)
    
    for followup in followups:
        if isinstance(followup['created_at'], str):
            followup['created_at'] = datetime.fromisoformat(followup['created_at'])
    
    return followups


@api_router.patch("/followups/{followup_id}")
async def update_followup_status(followup_id: str, followup_status: str, patient_status: Optional[str] = None):
    """Update followup status and sync with patient record"""
    
    # Get followup
    followup = await db.followups.find_one({"id": followup_id}, {"_id": 0})
    if not followup:
        raise HTTPException(status_code=404, detail="Takip bulunamadı")
    
    # Update followup
    update_data = {"followup_status": followup_status}
    if patient_status:
        update_data["patient_status"] = patient_status
    
    await db.followups.update_one(
        {"id": followup_id},
        {"$set": update_data}
    )
    
    # Sync with patient record if status changed
    if patient_status:
        patient_id = followup['patient_id']
        accepted = (patient_status == "kabul etti")
        await db.patients.update_one(
            {"id": patient_id},
            {"$set": {"status": patient_status, "accepted": accepted}}
        )
    
    return {"message": "Takip güncellendi ve hasta kaydı senkronize edildi"}


# WhatsApp Messages
@api_router.get("/whatsapp-messages", response_model=List[WhatsAppMessage])
async def get_whatsapp_messages(
    status: Optional[str] = None,
    message_type: Optional[str] = None,
    date: Optional[str] = None
):
    query = {}
    
    if status:
        query["status"] = status
    
    if message_type:
        query["message_type"] = message_type
    
    if date:
        query["scheduled_date"] = date
    
    messages = await db.whatsapp_messages.find(query, {"_id": 0}).sort("scheduled_date", 1).to_list(1000)
    
    for msg in messages:
        if isinstance(msg['created_at'], str):
            msg['created_at'] = datetime.fromisoformat(msg['created_at'])
    
    return messages


@api_router.patch("/whatsapp-messages/{message_id}/approve")
async def approve_and_send_message(message_id: str):
    """Approve message and mark as ready to send"""
    result = await db.whatsapp_messages.update_one(
        {"id": message_id},
        {"$set": {"approved": True, "status": "gönderildi"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
    
    return {"message": "Mesaj onaylandı ve gönderildi olarak işaretlendi"}


@api_router.patch("/whatsapp-messages/{message_id}")
async def update_message_status(message_id: str, status: str):
    result = await db.whatsapp_messages.update_one(
        {"id": message_id},
        {"$set": {"status": status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
    
    return {"message": "Mesaj durumu güncellendi"}


@api_router.post("/generate-daily-summaries")
async def generate_daily_summaries(date: str):
    """Generate daily WhatsApp summaries for all doctors"""
    generated_messages = []
    
    # Get doctor phone numbers
    doctor_info_list = await db.doctor_info.find({}, {"_id": 0}).to_list(100)
    doctor_phones = {d['doctor_name']: d['phone_number'] for d in doctor_info_list}
    
    # Get active doctors dynamically
    active_doctors = await db.doctors.find({"active": True}, {"_id": 0}).to_list(100)
    doctor_names = [d['name'] for d in active_doctors]
    
    for doctor in doctor_names:
        # Get patients for this doctor on this date
        patients = await db.patients.find(
            {"visit_date": date, "doctor": doctor},
            {"_id": 0}
        ).to_list(1000)
        
        if not patients:
            continue
        
        total_patients = len(patients)
        accepted = [p for p in patients if p['accepted']]
        not_accepted = [p for p in patients if not p['accepted']]
        
        # Count by visit type
        implants = sum(1 for p in patients if p['visit_type'] == 'implant')
        checkups = sum(1 for p in patients if p['visit_type'] == 'kontrol')
        examinations = sum(1 for p in patients if p['visit_type'] == 'muayene')
        revisits = sum(1 for p in patients if p.get('is_revisit', False))
        
        # Count new follow-ups
        followups = await db.followups.find(
            {"doctor": doctor, "followup_date": {"$gte": date}}
        ).to_list(1000)
        new_followups = len(followups)
        
        # Generate message in Turkish
        message = f"""Günlük Özet - {date}

Sayın {doctor},

Bugünkü hasta özetiniz:

📊 Toplam Hasta: {total_patients}
• İmplant: {implants}
• Kontrol: {checkups}
• Muayene: {examinations}
• Tekrar Görüşme: {revisits}

✅ Kabul Edilen: {len(accepted)}
❌ Düşünen/Ret: {len(not_accepted)}

📅 Yeni Takipler: {new_followups}

"""
        
        if accepted:
            message += "Kabul Edilen Hastalar:\n"
            for p in accepted:
                message += f"• {p['patient_name']} - {p['visit_type']}\n"
        
        if not_accepted:
            message += "\nDüşünen/Ret Hastalar:\n"
            for p in not_accepted:
                message += f"• {p['patient_name']} - {p['visit_type']}\n"
        
        phone = doctor_phones.get(doctor, "")
        
        whatsapp_msg = WhatsAppMessage(
            message_type="daily_summary",
            recipient_name=doctor,
            recipient_phone=phone,
            message_text=message,
            scheduled_date=date,
            status="onay_bekliyor",
            approved=False
        )
        
        msg_doc = whatsapp_msg.model_dump()
        msg_doc['created_at'] = msg_doc['created_at'].isoformat()
        await db.whatsapp_messages.insert_one(msg_doc)
        
        generated_messages.append(whatsapp_msg)
    
    return {"message": f"{len(generated_messages)} günlük özet oluşturuldu", "summaries": generated_messages}


# Statistics
@api_router.get("/statistics/weekly-trend")
async def get_weekly_trend(year: int, month: int):
    """Analyze weekly patient trends and detect low periods"""
    
    # Get all patients for the month
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        next_month_date = f"{year + 1}-01-01"
    else:
        next_month_date = f"{year}-{month + 1:02d}-01"
    
    patients = await db.patients.find(
        {
            "visit_date": {
                "$gte": start_date,
                "$lt": next_month_date
            }
        },
        {"_id": 0}
    ).to_list(10000)
    
    # Group by week
    from collections import defaultdict
    weekly_counts = defaultdict(int)
    
    for patient in patients:
        visit_date = datetime.fromisoformat(patient['visit_date'])
        # Get week number (1-4)
        day = visit_date.day
        week = ((day - 1) // 7) + 1
        weekly_counts[week] += 1
    
    # Calculate average
    if not weekly_counts:
        return {"warning": False, "message": "Bu ay için veri yok"}
    
    avg_patients = sum(weekly_counts.values()) / len(weekly_counts)
    
    # Check current week
    current_date = datetime.now(timezone.utc)
    current_week = ((current_date.day - 1) // 7) + 1
    
    # Only check if we're in the selected month
    if current_date.year == year and current_date.month == month:
        current_week_count = weekly_counts.get(current_week, 0)
        
        # Warning if 30% below average
        threshold = avg_patients * 0.7
        
        if current_week_count < threshold:
            return {
                "warning": True,
                "current_week": current_week,
                "current_count": current_week_count,
                "average": round(avg_patients, 1),
                "threshold": round(threshold, 1),
                "message": f"⚠️ Uyarı: Bu hafta hasta sayısı ortalamanın altında! (Mevcut: {current_week_count}, Ortalama: {round(avg_patients, 1)})"
            }
    
    return {
        "warning": False,
        "weekly_counts": dict(weekly_counts),
        "average": round(avg_patients, 1),
        "message": "Hasta sayısı normal seviyede"
    }


@api_router.get("/statistics/monthly", response_model=MonthlyStats)
async def get_monthly_statistics(year: int, month: int):
    """Calculate statistics for a specific month"""
    
    # Create date range for the month
    start_date = f"{year}-{month:02d}-01"
    
    # Calculate last day of month
    if month == 12:
        next_month_date = f"{year + 1}-01-01"
    else:
        next_month_date = f"{year}-{month + 1:02d}-01"
    
    # Get all patients for the month (only these three visit types)
    patients = await db.patients.find(
        {
            "visit_date": {
                "$gte": start_date,
                "$lt": next_month_date
            },
            "visit_type": {"$in": ["implant", "kontrol", "muayene"]}
        },
        {"_id": 0}
    ).to_list(10000)
    
    # Calculate clinic-wide statistics
    implant_count = sum(1 for p in patients if p['visit_type'] == 'implant')
    checkup_count = sum(1 for p in patients if p['visit_type'] == 'kontrol')
    examination_count = sum(1 for p in patients if p['visit_type'] == 'muayene')
    total_patients = implant_count + checkup_count + examination_count  # Total is sum of these three categories
    revisit_count = sum(1 for p in patients if p.get('is_revisit', False))
    
    # Calculate per-doctor statistics
    doctor_stats_dict = {}
    # Get active doctors dynamically
    active_doctors = await db.doctors.find({"active": True}, {"_id": 0}).to_list(100)
    doctor_names = [d['name'] for d in active_doctors]
    
    for doctor in doctor_names:
        doctor_patients = [p for p in patients if p['doctor'] == doctor]
        total = len(doctor_patients)
        accepted = sum(1 for p in doctor_patients if p['accepted'])
        acceptance_rate = (accepted / total * 100) if total > 0 else 0
        
        doctor_stats_dict[doctor] = DoctorStats(
            doctor=doctor,
            total_examinations=total,
            accepted_count=accepted,
            acceptance_rate=round(acceptance_rate, 1)
        )
    
    doctor_stats_list = list(doctor_stats_dict.values())
    
    # Calculate family statistics
    family_groups = {}
    for p in patients:
        if p.get('family_group'):
            fg = p['family_group']
            if fg not in family_groups:
                family_groups[fg] = {'total': 0, 'accepted': 0}
            family_groups[fg]['total'] += 1
            if p['accepted']:
                family_groups[fg]['accepted'] += 1
    
    family_stats_list = []
    for fg, data in family_groups.items():
        rate = (data['accepted'] / data['total'] * 100) if data['total'] > 0 else 0
        family_stats_list.append(FamilyStats(
            family_group=fg,
            patient_count=data['total'],
            accepted_count=data['accepted'],
            acceptance_rate=round(rate, 1)
        ))
    
    # Calculate profession statistics
    profession_groups = {}
    for p in patients:
        if p.get('profession_group'):
            pg = p['profession_group']
            if pg not in profession_groups:
                profession_groups[pg] = {'total': 0, 'accepted': 0}
            profession_groups[pg]['total'] += 1
            if p['accepted']:
                profession_groups[pg]['accepted'] += 1
    
    profession_stats_list = []
    for pg, data in profession_groups.items():
        rate = (data['accepted'] / data['total'] * 100) if data['total'] > 0 else 0
        profession_stats_list.append(ProfessionStats(
            profession_group=pg,
            patient_count=data['total'],
            accepted_count=data['accepted'],
            acceptance_rate=round(rate, 1)
        ))
    
    return MonthlyStats(
        total_patients=total_patients,
        implant_count=implant_count,
        checkup_count=checkup_count,
        examination_count=examination_count,
        revisit_count=revisit_count,
        doctor_stats=doctor_stats_list,
        family_stats=family_stats_list,
        profession_stats=profession_stats_list,
        total_families=len(family_groups),
        month=month,
        year=year
    )


# PDF Export Functions
def create_turkish_paragraph(text, style):
    """Create paragraph with Turkish characters support"""
    return Paragraph(text, style)


def create_monthly_stats_pdf(stats: MonthlyStats, month_name: str):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []
    styles = getSampleStyleSheet()
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=30,
        alignment=TA_CENTER
    )
    
    title = create_turkish_paragraph(f"Aylık İstatistik Raporu<br/>{month_name} {stats.year}", title_style)
    elements.append(title)
    elements.append(Spacer(1, 0.3*inch))
    
    # Summary statistics
    summary_data = [
        ['Metrik', 'Sayı'],
        ['Toplam Hasta', str(stats.total_patients)],
        ['İmplant', str(stats.implant_count)],
        ['Kontrol', str(stats.checkup_count)],
        ['Muayene', str(stats.examination_count)],
        ['Tekrar Görüşme', str(stats.revisit_count)],
        ['Aile Sayısı', str(stats.total_families)]
    ]
    
    summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 14),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    elements.append(summary_table)
    elements.append(Spacer(1, 0.5*inch))
    
    # Doctor performance
    elements.append(create_turkish_paragraph("Doktor Performansı", styles['Heading2']))
    elements.append(Spacer(1, 0.2*inch))
    
    doctor_data = [['Doktor', 'Muayene', 'Kabul', 'Oran']]
    for ds in stats.doctor_stats:
        doctor_data.append([
            ds.doctor,
            str(ds.total_examinations),
            str(ds.accepted_count),
            f"{ds.acceptance_rate}%"
        ])
    
    doctor_table = Table(doctor_data, colWidths=[2.5*inch, 1.5*inch, 1.5*inch, 1*inch])
    doctor_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#10b981')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.lightgreen),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    elements.append(doctor_table)
    
    # Family statistics if available
    if stats.family_stats:
        elements.append(Spacer(1, 0.5*inch))
        elements.append(create_turkish_paragraph("Aile İstatistikleri", styles['Heading2']))
        elements.append(Spacer(1, 0.2*inch))
        
        family_data = [['Aile Grubu', 'Hasta Sayısı', 'Kabul', 'Oran']]
        for fs in stats.family_stats:
            family_data.append([
                fs.family_group,
                str(fs.patient_count),
                str(fs.accepted_count),
                f"{fs.acceptance_rate}%"
            ])
        
        family_table = Table(family_data, colWidths=[2.5*inch, 1.5*inch, 1.5*inch, 1*inch])
        family_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f59e0b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.Color(1, 0.95, 0.8)),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        elements.append(family_table)
    
    # Profession statistics if available
    if stats.profession_stats:
        elements.append(Spacer(1, 0.5*inch))
        elements.append(create_turkish_paragraph("Meslek İstatistikleri", styles['Heading2']))
        elements.append(Spacer(1, 0.2*inch))
        
        profession_data = [['Meslek Grubu', 'Hasta Sayısı', 'Kabul', 'Oran']]
        for ps in stats.profession_stats:
            profession_data.append([
                ps.profession_group,
                str(ps.patient_count),
                str(ps.accepted_count),
                f"{ps.acceptance_rate}%"
            ])
        
        profession_table = Table(profession_data, colWidths=[2.5*inch, 1.5*inch, 1.5*inch, 1*inch])
        profession_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#8b5cf6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.Color(0.9, 0.85, 1)),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        elements.append(profession_table)
    
    doc.build(elements)
    buffer.seek(0)
    return buffer


def create_daily_report_pdf(date: str, patients: list):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []
    styles = getSampleStyleSheet()
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=30,
        alignment=TA_CENTER
    )
    
    title = create_turkish_paragraph(f"Günlük Hasta Raporu<br/>{date}", title_style)
    elements.append(title)
    elements.append(Spacer(1, 0.3*inch))
    
    # Patient list
    if not patients:
        elements.append(create_turkish_paragraph("Bu tarih için hasta bulunamadı.", styles['Normal']))
    else:
        patient_data = [['Hasta Adı', 'Doktor', 'Ziyaret Tipi', 'Durum']]
        for p in patients:
            status = 'Kabul Edildi' if p['accepted'] else 'Kabul Edilmedi'
            patient_data.append([
                p['patient_name'],
                p['doctor'],
                p['visit_type'],
                status
            ])
        
        patient_table = Table(patient_data, colWidths=[2*inch, 2*inch, 1.5*inch, 1.5*inch])
        patient_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.lightblue),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        elements.append(patient_table)
    
    doc.build(elements)
    buffer.seek(0)
    return buffer


@api_router.get("/export/monthly-stats-pdf")
async def export_monthly_stats_pdf(year: int, month: int):
    stats = await get_monthly_statistics(year, month)
    
    month_names = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                   'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
    month_name = month_names[month]
    
    pdf_buffer = create_monthly_stats_pdf(stats, month_name)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=aylik_istatistik_{year}_{month:02d}.pdf"}
    )


@api_router.get("/export/daily-report-pdf")
async def export_daily_report_pdf(date: str):
    daily_data = await get_daily_patients(date)
    patients = daily_data['patients']
    
    pdf_buffer = create_daily_report_pdf(date, patients)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=gunluk_rapor_{date}.pdf"}
    )


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()