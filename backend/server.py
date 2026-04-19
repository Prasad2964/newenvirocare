from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import os
import logging
import hashlib
import random
import math
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import jwt
import bcrypt
import base64 as b64lib
import json
import requests as http_requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Supabase
supabase: Client = create_client(
    os.environ['SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_KEY']
)

JWT_SECRET = os.environ.get('JWT_SECRET', 'envirocare_default_secret')
JWT_ALGORITHM = "HS256"

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ===================== MODELS =====================

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class HealthProfileRequest(BaseModel):
    conditions: List[str] = []
    medications: List[str] = []
    age: Optional[int] = None
    blood_group: Optional[str] = None
    allergies: List[str] = []
    notes: Optional[str] = None

class RoutineRequest(BaseModel):
    activity: str
    time: str
    type: str = "outdoor"
    days: List[str] = ["Mon", "Tue", "Wed", "Thu", "Fri"]

class SymptomRequest(BaseModel):
    symptoms: List[str]
    severity: int = 5
    notes: Optional[str] = None

class PhotoRequest(BaseModel):
    image_base64: str
    mime_type: str = "image/jpeg"

class TravelRequest(BaseModel):
    origin: str
    destination: str
    mode: str = "car"

class CityCompareRequest(BaseModel):
    city1: str
    city2: str

class RiskAssessmentRequest(BaseModel):
    city: str

class RoutineAdjustRequest(BaseModel):
    city: str

class OCRRequest(BaseModel):
    image_base64: str
    mime_type: str = "image/jpeg"

# ===================== JWT HELPERS =====================

def create_token(user_id: str, name: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "name": name,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ===================== MOCK AQI DATA =====================

CITY_AQI_BASE = {
    "delhi": 185, "mumbai": 110, "bangalore": 68, "chennai": 82,
    "kolkata": 145, "hyderabad": 92, "pune": 88, "ahmedabad": 130,
    "jaipur": 155, "lucknow": 170, "kanpur": 195, "varanasi": 165,
    "surat": 105, "nagpur": 95, "indore": 78, "bhopal": 85,
    "patna": 180, "guwahati": 72, "chandigarh": 65, "kochi": 42,
    "new york": 35, "london": 28, "beijing": 160, "tokyo": 32,
    "paris": 38, "dubai": 90, "singapore": 25, "sydney": 22,
    "los angeles": 55, "shanghai": 140, "bangkok": 105, "jakarta": 125,
    "cairo": 155, "mexico city": 115, "seoul": 48, "berlin": 30,
    "toronto": 20, "sao paulo": 65, "moscow": 58,
    "gujarat": 120, "rajkot": 115, "vadodara": 108,
}

WEATHER_BASE = {
    "delhi": {"temp": 32, "humidity": 55, "wind": 8, "desc": "Hazy"},
    "mumbai": {"temp": 30, "humidity": 78, "wind": 12, "desc": "Humid"},
    "bangalore": {"temp": 26, "humidity": 62, "wind": 10, "desc": "Pleasant"},
    "pune": {"temp": 28, "humidity": 58, "wind": 9, "desc": "Partly Cloudy"},
    "chennai": {"temp": 33, "humidity": 72, "wind": 14, "desc": "Hot & Humid"},
    "kolkata": {"temp": 31, "humidity": 70, "wind": 7, "desc": "Overcast"},
    "hyderabad": {"temp": 29, "humidity": 55, "wind": 11, "desc": "Clear"},
}

POLLUTANT_NAMES = ["PM2.5", "PM10", "NO2", "SO2", "CO", "O3"]

def get_aqi_level(aqi: int) -> str:
    if aqi <= 50: return "good"
    if aqi <= 100: return "moderate"
    if aqi <= 200: return "unhealthy"
    if aqi <= 300: return "very_unhealthy"
    return "hazardous"

def get_mask_recommendation(aqi: int) -> dict:
    if aqi <= 50:
        return {"type": "none", "label": "No mask needed", "icon": "checkmark-circle"}
    if aqi <= 100:
        return {"type": "optional", "label": "Mask optional", "icon": "medical"}
    if aqi <= 200:
        return {"type": "surgical", "label": "Surgical mask recommended", "icon": "medical"}
    return {"type": "n95", "label": "N95 mask essential", "icon": "warning"}

def generate_city_aqi(city: str) -> dict:
    city_lower = city.lower().strip()
    base_aqi = CITY_AQI_BASE.get(city_lower, 50 + (hash(city_lower) % 150))
    hour = datetime.now(timezone.utc).hour
    variation = int(15 * math.sin(hour * math.pi / 12))
    random.seed(hash(city_lower + str(datetime.now(timezone.utc).date())))
    daily_var = random.randint(-20, 20)
    aqi = max(5, min(500, base_aqi + variation + daily_var))

    pm25 = round(aqi * 0.45 + random.uniform(-5, 5), 1)
    pm10 = round(aqi * 0.65 + random.uniform(-8, 8), 1)
    no2 = round(aqi * 0.25 + random.uniform(-3, 3), 1)
    so2 = round(aqi * 0.08 + random.uniform(-2, 2), 1)
    co = round(aqi * 0.01 + random.uniform(0, 0.5), 2)
    o3 = round(aqi * 0.35 + random.uniform(-5, 5), 1)

    primary = "PM2.5" if pm25 > pm10 * 0.6 else "PM10"
    if no2 > pm25: primary = "NO2"

    weather_base = WEATHER_BASE.get(city_lower, {"temp": 25 + random.randint(-5, 10), "humidity": 50 + random.randint(-15, 25), "wind": 8 + random.randint(-3, 8), "desc": "Clear"})
    temp_var = random.randint(-3, 3)

    level = get_aqi_level(aqi)
    return {
        "city": city,
        "aqi": aqi,
        "level": level,
        "primary_pollutant": primary,
        "pollutants": {
            "pm25": max(0, pm25), "pm10": max(0, pm10),
            "no2": max(0, no2), "so2": max(0, so2),
            "co": max(0, co), "o3": max(0, o3)
        },
        "weather": {
            "temperature": weather_base["temp"] + temp_var,
            "humidity": min(100, max(10, weather_base["humidity"] + random.randint(-5, 5))),
            "wind_speed": max(0, weather_base["wind"] + random.randint(-3, 3)),
            "description": weather_base["desc"]
        },
        "mask": get_mask_recommendation(aqi),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "is_emergency": aqi > 300
    }

# ===================== REAL AQI (WAQI with mock fallback) =====================

async def fetch_city_aqi(city: str) -> dict:
    waqi_token = os.environ.get('WAQI_TOKEN', '')
    if waqi_token:
        try:
            response = http_requests.get(
                f"https://api.waqi.info/feed/{city}/?token={waqi_token}",
                timeout=5
            )
            data = response.json()
            if data.get('status') == 'ok':
                d = data['data']
                aqi = int(d.get('aqi', 0))
                iaqi = d.get('iaqi', {})
                return {
                    "city": city.title(),
                    "aqi": aqi,
                    "level": get_aqi_level(aqi),
                    "primary_pollutant": "PM2.5",
                    "pollutants": {
                        "pm25": iaqi.get('pm25', {}).get('v', 0),
                        "pm10": iaqi.get('pm10', {}).get('v', 0),
                        "no2":  iaqi.get('no2',  {}).get('v', 0),
                        "so2":  iaqi.get('so2',  {}).get('v', 0),
                        "co":   iaqi.get('co',   {}).get('v', 0),
                        "o3":   iaqi.get('o3',   {}).get('v', 0),
                    },
                    "weather": {
                        "temperature": iaqi.get('t', {}).get('v', 25),
                        "humidity":    iaqi.get('h', {}).get('v', 50),
                        "wind_speed":  iaqi.get('w', {}).get('v', 10),
                        "description": "Live data"
                    },
                    "mask": get_mask_recommendation(aqi),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "is_emergency": aqi > 300,
                    "source": "live"
                }
        except Exception as e:
            logger.warning(f"WAQI API failed for {city}, using mock: {e}")
    return generate_city_aqi(city)

# ===================== RISK CALCULATOR =====================

CONDITION_MULTIPLIERS = {
    "asthma": 2.0, "copd": 2.5, "heart disease": 1.8,
    "diabetes": 1.3, "hypertension": 1.4, "lung disease": 2.2,
    "bronchitis": 1.9, "allergies": 1.5, "pregnancy": 1.6,
    "elderly": 1.5, "child": 1.4,
}

def calculate_risk_score(aqi: int, conditions: List[str]) -> dict:
    base_risk = min(100, (aqi / 500) * 100)
    multiplier = 1.0
    risk_conditions = []
    for c in conditions:
        c_lower = c.lower().strip()
        for key, mult in CONDITION_MULTIPLIERS.items():
            if key in c_lower:
                multiplier = max(multiplier, mult)
                risk_conditions.append({"condition": c, "impact": f"{mult}x risk"})

    final_risk = min(100, base_risk * multiplier)

    if final_risk <= 25: level = "low"
    elif final_risk <= 50: level = "medium"
    elif final_risk <= 75: level = "high"
    else: level = "dangerous"

    return {
        "score": round(final_risk, 1),
        "level": level,
        "base_risk": round(base_risk, 1),
        "multiplier": multiplier,
        "affected_conditions": risk_conditions
    }

# ===================== AI HELPERS =====================

async def get_ai_advice(aqi_data: dict, health_profile: dict, context: str = "general"):
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get('EMERGENT_LLM_KEY', '')
        if not api_key:
            return generate_rule_based_advice(aqi_data, health_profile)

        chat = LlmChat(
            api_key=api_key,
            session_id=f"envirocare-{uuid4()}",
            system_message="You are EnviroCare AI, a health advisor specializing in air quality impact on health. Give concise, actionable advice in 2-3 sentences. Be specific about the user's conditions."
        ).with_model("gemini", "gemini-2.0-flash")

        conditions = health_profile.get("conditions", [])
        aqi = aqi_data.get("aqi", 0)
        city = aqi_data.get("city", "Unknown")
        weather = aqi_data.get("weather", {})

        prompt = f"""Context: {context}
City: {city}, AQI: {aqi} ({aqi_data.get('level', 'unknown')})
Primary pollutant: {aqi_data.get('primary_pollutant', 'PM2.5')}
Weather: {weather.get('temperature', 25)}°C, Humidity: {weather.get('humidity', 50)}%, Wind: {weather.get('wind_speed', 10)} km/h
User conditions: {', '.join(conditions) if conditions else 'None reported'}
Medications: {', '.join(health_profile.get('medications', [])) if health_profile.get('medications') else 'None'}

Provide personalized health advice based on current air quality and the user's health profile. Include specific actions they should take."""

        response = await chat.send_message(UserMessage(text=prompt))
        return response
    except Exception as e:
        logger.error(f"AI advice error: {e}")
        return generate_rule_based_advice(aqi_data, health_profile)

def generate_rule_based_advice(aqi_data: dict, health_profile: dict) -> str:
    aqi = aqi_data.get("aqi", 0)
    conditions = health_profile.get("conditions", [])
    level = get_aqi_level(aqi)

    advice_parts = []
    if level == "good":
        advice_parts.append("Air quality is good. Safe for outdoor activities.")
    elif level == "moderate":
        advice_parts.append("Air quality is moderate. Sensitive individuals should limit prolonged outdoor exertion.")
    elif level == "unhealthy":
        advice_parts.append("Air quality is unhealthy. Reduce outdoor activities and wear a mask when outside.")
    else:
        advice_parts.append("Air quality is dangerous! Stay indoors with windows closed. Use air purifiers if available.")

    for c in conditions:
        c_lower = c.lower()
        if "asthma" in c_lower:
            advice_parts.append("Keep your inhaler accessible. Avoid triggers.")
        if "copd" in c_lower:
            advice_parts.append("Use supplemental oxygen if prescribed. Monitor breathing closely.")
        if "heart" in c_lower:
            advice_parts.append("Avoid strenuous activities. Monitor blood pressure.")
        if "allerg" in c_lower:
            advice_parts.append("Take antihistamines preventively. Keep windows closed.")

    return " ".join(advice_parts)

# ===================== AUTH ENDPOINTS =====================

@api_router.post("/auth/signup")
async def signup(req: SignupRequest):
    logger.info(f"Signup attempt for email: {req.email.lower()}")
    try:
        existing = supabase.table("users").select("user_id").eq("email", req.email.lower()).execute()
        existing_data = getattr(existing, 'data', None) or []
        if len(existing_data) > 0:
            logger.warning(f"Signup failed - email already registered: {req.email.lower()}")
            raise HTTPException(status_code=400, detail="Email already registered")

        hashed = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
        user_id = str(uuid4())
        user = {
            "user_id": user_id,
            "name": req.name,
            "email": req.email.lower(),
            "password": hashed,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        supabase.table("users").insert(user).execute()
        logger.info(f"Signup success for user_id: {user_id}")
        return {"message": "Account created successfully", "user_id": user_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Signup failed: {str(e)}")

@api_router.post("/auth/login")
async def login(req: LoginRequest):
    logger.info(f"Login attempt for email: {req.email.lower()}")
    try:
        result = supabase.table("users").select("*").eq("email", req.email.lower()).execute()
        result_data = getattr(result, 'data', None) or []
        user = result_data[0] if result_data else None
        if not user:
            logger.warning(f"Login failed - user not found: {req.email.lower()}")
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not bcrypt.checkpw(req.password.encode(), user["password"].encode()):
            logger.warning(f"Login failed - wrong password for: {req.email.lower()}")
            raise HTTPException(status_code=401, detail="Invalid credentials")

        token = create_token(user["user_id"], user["name"], user["email"])
        logger.info(f"Login success for user_id: {user['user_id']}")
        return {"token": token, "user": {"user_id": user["user_id"], "name": user["name"], "email": user["email"]}}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return {"user_id": user["user_id"], "name": user["name"], "email": user["email"]}

@api_router.post("/auth/google")
async def google_auth(body: dict):
    id_token_str = body.get("id_token")
    access_token_str = body.get("access_token")

    google_info = None

    # Verify id_token via Google tokeninfo
    if id_token_str:
        try:
            r = http_requests.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token_str}",
                timeout=10
            )
            if r.status_code == 200:
                data = r.json()
                if "error" not in data:
                    google_info = data
        except Exception as e:
            logger.warning(f"Google id_token verify failed: {e}")

    # Fallback: verify access_token via userinfo endpoint
    if not google_info and access_token_str:
        try:
            r = http_requests.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token_str}"},
                timeout=10
            )
            if r.status_code == 200:
                google_info = r.json()
        except Exception as e:
            logger.warning(f"Google access_token verify failed: {e}")

    if not google_info:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    email = (google_info.get("email") or "").lower()
    name = google_info.get("name") or google_info.get("given_name") or email.split("@")[0]
    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")

    try:
        result = supabase.table("users").select("*").eq("email", email).execute()
        users_data = getattr(result, 'data', None) or []

        if users_data:
            user = users_data[0]
            logger.info(f"Google login for existing user: {email}")
        else:
            user_id = str(uuid4())
            user = {
                "user_id": user_id,
                "name": name,
                "email": email,
                "password": "",  # Google users have no password
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            supabase.table("users").insert(user).execute()
            logger.info(f"Google signup — new user created: {email}")

        token = create_token(user["user_id"], user["name"], user["email"])
        return {
            "token": token,
            "user": {"user_id": user["user_id"], "name": user["name"], "email": user["email"]}
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(status_code=500, detail="Google authentication failed")

@api_router.delete("/auth/account")
async def delete_account(user=Depends(get_current_user)):
    uid = user["user_id"]
    # CASCADE DELETE handles related tables automatically via FK constraints
    supabase.table("users").delete().eq("user_id", uid).execute()
    return {"message": "Account deleted"}

# ===================== AQI ENDPOINTS =====================

@api_router.get("/aqi/{city}")
async def get_city_aqi(city: str):
    return await fetch_city_aqi(city)

@api_router.post("/aqi/compare")
async def compare_cities(req: CityCompareRequest):
    return {"city1": await fetch_city_aqi(req.city1), "city2": await fetch_city_aqi(req.city2)}

# ===================== HEALTH PROFILE ENDPOINTS =====================

@api_router.post("/health-profile")
async def save_health_profile(req: HealthProfileRequest, user=Depends(get_current_user)):
    profile = {
        "user_id": user["user_id"],
        "conditions": req.conditions,
        "medications": req.medications,
        "age": req.age,
        "blood_group": req.blood_group,
        "allergies": req.allergies,
        "notes": req.notes,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    supabase.table("health_profiles").upsert(profile, on_conflict="user_id").execute()
    return {"message": "Health profile saved", "profile": profile}

@api_router.get("/health-profile")
async def get_health_profile(user=Depends(get_current_user)):
    result = supabase.table("health_profiles").select("*").eq("user_id", user["user_id"]).execute()
    data = (getattr(result, 'data', None) or [])
    return data[0] if data else {"conditions": [], "medications": [], "allergies": [], "notes": None}

@api_router.post("/profile/photo")
async def upload_profile_photo(req: PhotoRequest, user=Depends(get_current_user)):
    try:
        import base64 as b64
        image_data = b64.b64decode(req.image_base64)
        bucket_name = "profile-photos"
        file_path = f"{user['user_id']}/avatar.jpg"
        try:
            supabase.storage.create_bucket(bucket_name, options={"public": True})
        except Exception:
            pass
        supabase.storage.from_(bucket_name).upload(
            file_path, image_data,
            file_options={"content-type": req.mime_type, "upsert": "true"}
        )
        url = supabase.storage.from_(bucket_name).get_public_url(file_path)
        supabase.table("health_profiles").upsert(
            {"user_id": user["user_id"], "photo_url": url, "updated_at": datetime.now(timezone.utc).isoformat()},
            on_conflict="user_id"
        ).execute()
        return {"photo_url": url}
    except Exception as e:
        logger.error(f"Photo upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Photo upload failed: {str(e)}")

@api_router.delete("/health-profile")
async def delete_health_profile(user=Depends(get_current_user)):
    try:
        result = supabase.table("health_profiles").delete().eq("user_id", user["user_id"]).execute()
        logger.info(f"Health profile deleted for user {user['user_id']}")
        return {"message": "Health profile deleted"}
    except Exception as e:
        logger.error(f"Delete health profile error for user {user['user_id']}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete profile: {str(e)}")

# ===================== RISK ASSESSMENT =====================

@api_router.post("/risk-assessment")
async def risk_assessment(req: RiskAssessmentRequest, user=Depends(get_current_user)):
    aqi_data = generate_city_aqi(req.city)
    result = supabase.table("health_profiles").select("*").eq("user_id", user["user_id"]).execute()
    profile = ((getattr(result, 'data', None) or []) or [None])[0] or {}
    conditions = profile.get("conditions", [])

    risk = calculate_risk_score(aqi_data["aqi"], conditions)
    advice = await get_ai_advice(aqi_data, profile, "risk assessment")

    return {
        "aqi": aqi_data,
        "risk": risk,
        "advice": advice,
        "mask": aqi_data["mask"],
        "emergency": aqi_data["is_emergency"]
    }

# ===================== ROUTINE ENDPOINTS =====================

@api_router.post("/routines")
async def create_routine(req: RoutineRequest, user=Depends(get_current_user)):
    routine_id = str(uuid4())
    routine = {
        "routine_id": routine_id,
        "user_id": user["user_id"],
        "activity": req.activity,
        "time": req.time,
        "type": req.type,
        "days": req.days,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    supabase.table("routines").insert(routine).execute()
    return routine

@api_router.get("/routines")
async def get_routines(user=Depends(get_current_user)):
    result = supabase.table("routines").select("*").eq("user_id", user["user_id"]).limit(100).execute()
    return result.data

@api_router.delete("/routines/{routine_id}")
async def delete_routine(routine_id: str, user=Depends(get_current_user)):
    supabase.table("routines").delete().eq("routine_id", routine_id).eq("user_id", user["user_id"]).execute()
    return {"message": "Routine deleted"}

@api_router.post("/routines/ai-adjust")
async def ai_adjust_routines(req: RoutineAdjustRequest, user=Depends(get_current_user)):
    routines = supabase.table("routines").select("*").eq("user_id", user["user_id"]).limit(100).execute().data
    aqi_data = generate_city_aqi(req.city)
    _hp = supabase.table("health_profiles").select("*").eq("user_id", user["user_id"]).execute()
    health_profile = ((getattr(_hp, 'data', None) or [None])[0]) or {}

    adjustments = []
    for r in routines:
        is_risky = r["type"] == "outdoor" and aqi_data["aqi"] > 100
        suggestion = None
        if is_risky:
            if "walk" in r["activity"].lower() or "run" in r["activity"].lower():
                suggestion = "Switch to indoor exercise or treadmill"
            elif "gym" in r["activity"].lower() and r["type"] == "outdoor":
                suggestion = "Move workout indoors"
            elif "commute" in r["activity"].lower() or "travel" in r["activity"].lower():
                suggestion = "Wear N95 mask during commute"
            else:
                suggestion = "Consider postponing or moving indoors"

        adjustments.append({
            **r,
            "is_risky": is_risky,
            "suggestion": suggestion,
            "risk_level": "high" if is_risky and aqi_data["aqi"] > 200 else ("medium" if is_risky else "low")
        })

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get('EMERGENT_LLM_KEY', '')
        if api_key and routines:
            chat = LlmChat(
                api_key=api_key,
                session_id=f"routine-{uuid4()}",
                system_message="You are a health routine advisor. Provide a brief overall recommendation for the day based on air quality and weather conditions. Max 2 sentences."
            ).with_model("gemini", "gemini-2.0-flash")

            activities = ", ".join([f"{r['activity']} at {r['time']} ({r['type']})" for r in routines])
            msg = f"AQI: {aqi_data['aqi']}, Weather: {aqi_data['weather']['temperature']}°C, Routines: {activities}"
            ai_summary = await chat.send_message(UserMessage(text=msg))
        else:
            ai_summary = "Check air quality before outdoor activities." if aqi_data["aqi"] > 100 else "Good conditions for your planned activities."
    except Exception:
        ai_summary = "Monitor air quality throughout the day."

    return {"adjustments": adjustments, "aqi": aqi_data, "ai_summary": ai_summary}

# ===================== CHAT ENDPOINTS =====================

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    aqi: Optional[int] = None
    city: Optional[str] = None

CHAT_DAILY_LIMIT = 3

@api_router.get("/chat/usage")
async def get_chat_usage(user=Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    result = supabase.table("chat_usage").select("*").eq("user_id", user["user_id"]).eq("date", today).execute()
    data = getattr(result, 'data', None) or []
    used = data[0]["message_count"] if data else 0
    return {"messages_used": used, "messages_limit": CHAT_DAILY_LIMIT, "messages_remaining": max(0, CHAT_DAILY_LIMIT - used)}

@api_router.post("/chat")
async def chat(req: ChatRequest, user=Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()

    # Fail-safe usage check — table may not exist yet
    used = 0
    usage_data = []
    try:
        usage_result = supabase.table("chat_usage").select("*").eq("user_id", user["user_id"]).eq("date", today).execute()
        usage_data = getattr(usage_result, 'data', None) or []
        used = usage_data[0]["message_count"] if usage_data else 0
    except Exception as e:
        logger.warning(f"chat_usage table query failed (table may not exist): {e}")

    if used >= CHAT_DAILY_LIMIT:
        raise HTTPException(status_code=429, detail=f"Daily limit of {CHAT_DAILY_LIMIT} messages reached. Upgrade to Premium for unlimited chats.")

    # Fail-safe profile fetch
    profile = {}
    recent_symptoms = []
    try:
        profile_result = supabase.table("health_profiles").select("*").eq("user_id", user["user_id"]).execute()
        profile = ((getattr(profile_result, 'data', None) or [None])[0]) or {}
        symptoms_result = supabase.table("symptoms").select("*").eq("user_id", user["user_id"]).order("logged_at", desc=True).limit(3).execute()
        recent_symptoms = getattr(symptoms_result, 'data', None) or []
    except Exception as e:
        logger.warning(f"Profile/symptoms fetch failed: {e}")

    conditions = profile.get("conditions", [])
    medications = profile.get("medications", [])
    allergies = profile.get("allergies", [])
    symptom_text = "; ".join([", ".join(s.get("symptoms", [])) for s in recent_symptoms]) if recent_symptoms else "None recently"
    aqi_info = f"AQI {req.aqi}" if req.aqi else "AQI unknown"

    system_prompt = f"""You are EnviroCare AI, a personal health assistant specializing in air quality and its effects on health.

User Profile:
- Medical Conditions: {', '.join(conditions) if conditions else 'None'}
- Medications: {', '.join(medications) if medications else 'None'}
- Allergies: {', '.join(allergies) if allergies else 'None'}
- Recent Symptoms: {symptom_text}
- Current AQI: {aqi_info} in {req.city or 'their city'}

Guidelines:
- Be concise (2-4 sentences), actionable, empathetic
- Always tailor advice to their specific conditions
- Never diagnose — suggest consulting a doctor for medical concerns
- Focus on air quality, breathing safety, and outdoor activity guidance"""

    try:
        import google.generativeai as genai
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("EMERGENT_LLM_KEY", "")
        if not api_key:
            logger.error("GEMINI_API_KEY is not set in environment variables")
            raise HTTPException(status_code=503, detail="AI service is not configured. Please contact support.")
        genai.configure(api_key=api_key)

        history = []
        for msg in req.history[-6:]:
            history.append({"role": "user" if msg.role == "user" else "model", "parts": [msg.content]})

        reply = None
        for model_name in ["gemini-2.0-flash", "gemini-1.5-flash"]:
            try:
                model = genai.GenerativeModel(model_name, system_instruction=system_prompt)
                chat_session = model.start_chat(history=history)
                response = chat_session.send_message(req.message, request_options={"timeout": 30})
                reply = response.text
                break
            except Exception as model_err:
                err_str = str(model_err).lower()
                if "resource_exhausted" in err_str or "resourceexhausted" in err_str or "429" in err_str:
                    logger.warning(f"{model_name} quota exhausted, trying next model")
                    continue
                raise

        if not reply:
            raise HTTPException(status_code=429, detail="AI quota exceeded. Please wait a minute and try again.")

        # Fail-safe usage update
        try:
            if usage_data:
                supabase.table("chat_usage").update({"message_count": used + 1}).eq("user_id", user["user_id"]).eq("date", today).execute()
            else:
                supabase.table("chat_usage").insert({"id": str(uuid4()), "user_id": user["user_id"], "message_count": 1, "date": today}).execute()
        except Exception as e:
            logger.warning(f"chat_usage update failed: {e}")

        return {"reply": reply, "messages_used": used + 1, "messages_limit": CHAT_DAILY_LIMIT, "messages_remaining": max(0, CHAT_DAILY_LIMIT - used - 1)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat error for user {user['user_id']}: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"AI assistant error: {type(e).__name__}")

# ===================== SYMPTOM ENDPOINTS =====================

@api_router.post("/symptoms")
async def log_symptom(req: SymptomRequest, user=Depends(get_current_user)):
    try:
        symptom_id = str(uuid4())
        entry = {
            "symptom_id": symptom_id,
            "user_id": user["user_id"],
            "symptoms": req.symptoms,
            "severity": req.severity,
            "notes": req.notes,
            "logged_at": datetime.now(timezone.utc).isoformat()
        }
        supabase.table("symptoms").insert(entry).execute()
        logger.info(f"Symptom logged for user {user['user_id']}: {req.symptoms}")
        return entry
    except Exception as e:
        logger.error(f"Log symptom error for user {user['user_id']}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to log symptoms: {str(e)}")

@api_router.get("/symptoms")
async def get_symptoms(user=Depends(get_current_user)):
    try:
        result = supabase.table("symptoms").select("*").eq("user_id", user["user_id"]).order("logged_at", desc=True).limit(50).execute()
        return getattr(result, 'data', None) or []
    except Exception as e:
        logger.error(f"Get symptoms error: {e}")
        return []

# ===================== TRAVEL ENDPOINT =====================

@api_router.post("/travel/plan")
async def plan_travel(req: TravelRequest, user=Depends(get_current_user)):
    origin_aqi = generate_city_aqi(req.origin)
    dest_aqi = generate_city_aqi(req.destination)
    _p = supabase.table("health_profiles").select("*").eq("user_id", user["user_id"]).execute()
    profile = ((getattr(_p, 'data', None) or [None])[0]) or {}
    conditions = profile.get("conditions", [])

    origin_risk = calculate_risk_score(origin_aqi["aqi"], conditions)
    dest_risk = calculate_risk_score(dest_aqi["aqi"], conditions)

    travel_advice = await get_ai_advice(
        dest_aqi, profile,
        f"Travel from {req.origin} (AQI {origin_aqi['aqi']}) to {req.destination} (AQI {dest_aqi['aqi']}) by {req.mode}"
    )

    precautions = []
    if dest_aqi["aqi"] > 150:
        precautions.append("Carry N95 mask")
    if "asthma" in str(conditions).lower():
        precautions.append("Carry inhaler")
    if dest_aqi["weather"]["temperature"] > 35:
        precautions.append("Stay hydrated")
    if dest_aqi["aqi"] > 200:
        precautions.append("Avoid outdoor activity at destination")
    if not precautions:
        precautions.append("No special precautions needed")

    return {
        "origin": origin_aqi,
        "destination": dest_aqi,
        "origin_risk": origin_risk,
        "destination_risk": dest_risk,
        "travel_advice": travel_advice,
        "precautions": precautions,
        "mode": req.mode
    }

# ===================== HEALTH REPORT =====================

@api_router.get("/health-report")
async def get_health_report(user=Depends(get_current_user)):
    symptoms = supabase.table("symptoms").select("*").eq("user_id", user["user_id"]).order("logged_at", desc=True).limit(100).execute().data
    _p = supabase.table("health_profiles").select("*").eq("user_id", user["user_id"]).execute()
    profile = ((getattr(_p, 'data', None) or [None])[0]) or {}

    total_logs = len(symptoms)
    symptom_counts = {}
    for s in symptoms:
        for sym in s.get("symptoms", []):
            symptom_counts[sym] = symptom_counts.get(sym, 0) + 1

    return {
        "total_symptom_logs": total_logs,
        "symptom_frequency": symptom_counts,
        "conditions": profile.get("conditions", []),
        "period": "Last 30 days",
        "summary": f"You logged {total_logs} symptom entries. {'Most common: ' + max(symptom_counts, key=symptom_counts.get) if symptom_counts else 'No symptoms logged yet.'}"
    }

# ===================== ACTIVITY HISTORY =====================

@api_router.post("/activity")
async def log_activity(user=Depends(get_current_user), body: dict = {}):
    entry = {
        "activity_id": str(uuid4()),
        "user_id": user["user_id"],
        "type": body.get("type", "aqi_check"),
        "city": body.get("city", ""),
        "aqi": body.get("aqi", 0),
        "risk_level": body.get("risk_level", "low"),
        "description": body.get("description", ""),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    supabase.table("activities").insert(entry).execute()
    return entry

@api_router.get("/activities")
async def get_activities(user=Depends(get_current_user)):
    result = supabase.table("activities").select("*").eq("user_id", user["user_id"]).order("timestamp", desc=True).limit(100).execute()
    return result.data

# ===================== USER SETTINGS =====================

class SettingsRequest(BaseModel):
    safe_aqi_threshold: int = 50
    risky_aqi_threshold: int = 150
    dangerous_aqi_threshold: int = 300
    notify_daily_updates: bool = True
    notify_high_risk: bool = True
    notify_travel: bool = True
    notify_routine: bool = True
    default_city: str = "Mumbai"

@api_router.post("/settings")
async def save_settings(req: SettingsRequest, user=Depends(get_current_user)):
    settings = {
        "user_id": user["user_id"],
        **req.dict(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    supabase.table("settings").upsert(settings, on_conflict="user_id").execute()
    return {"message": "Settings saved", "settings": settings}

@api_router.get("/settings")
async def get_settings(user=Depends(get_current_user)):
    result = supabase.table("settings").select("*").eq("user_id", user["user_id"]).execute()
    _settings_data = (getattr(result, 'data', None) or [])
    if not _settings_data:
        return {
            "safe_aqi_threshold": 50, "risky_aqi_threshold": 150,
            "dangerous_aqi_threshold": 300, "notify_daily_updates": True,
            "notify_high_risk": True, "notify_travel": True,
            "notify_routine": True, "default_city": "Mumbai"
        }
    return _settings_data[0]

# ===================== NOTIFICATION LOG =====================

@api_router.post("/notifications/log")
async def log_notification(user=Depends(get_current_user), body: dict = {}):
    entry = {
        "notification_id": str(uuid4()),
        "user_id": user["user_id"],
        "type": body.get("type", "alert"),
        "title": body.get("title", ""),
        "message": body.get("message", ""),
        "read": False,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    supabase.table("notifications").insert(entry).execute()
    return entry

@api_router.get("/notifications")
async def get_notifications(user=Depends(get_current_user)):
    result = supabase.table("notifications").select("*").eq("user_id", user["user_id"]).order("timestamp", desc=True).limit(50).execute()
    return result.data

@api_router.post("/notifications/read/{notification_id}")
async def mark_read(notification_id: str, user=Depends(get_current_user)):
    supabase.table("notifications").update({"read": True}).eq("notification_id", notification_id).eq("user_id", user["user_id"]).execute()
    return {"message": "Marked as read"}

# ===================== TRAVEL HOTSPOTS =====================

@api_router.post("/travel/hotspots")
async def get_travel_hotspots(user=Depends(get_current_user), body: dict = {}):
    origin = body.get("origin", "Mumbai")
    destination = body.get("destination", "Delhi")
    origin_aqi = generate_city_aqi(origin)
    dest_aqi = generate_city_aqi(destination)

    random.seed(hash(origin + destination + str(datetime.now(timezone.utc).date())))
    midpoints = []
    num_points = random.randint(3, 6)
    for i in range(num_points):
        mid_city = f"Stop {i+1}"
        mid_aqi = random.randint(
            min(origin_aqi["aqi"], dest_aqi["aqi"]) - 30,
            max(origin_aqi["aqi"], dest_aqi["aqi"]) + 30
        )
        mid_aqi = max(10, min(500, mid_aqi))
        level = get_aqi_level(mid_aqi)
        midpoints.append({
            "name": mid_city,
            "aqi": mid_aqi,
            "level": level,
            "is_hotspot": mid_aqi > 150,
            "description": f"AQI {mid_aqi} - {'Pollution hotspot!' if mid_aqi > 150 else 'Moderate zone'}",
            "precaution": get_mask_recommendation(mid_aqi)["label"]
        })

    return {
        "origin": {"name": origin, "aqi": origin_aqi["aqi"]},
        "destination": {"name": destination, "aqi": dest_aqi["aqi"]},
        "hotspots": midpoints,
        "high_risk_count": sum(1 for p in midpoints if p["is_hotspot"])
    }

# ===================== ROOT =====================

@api_router.get("/")
async def root():
    return {"message": "EnviroCare AI API", "version": "3.0.0"}

# ===================== EXPOSURE TRACKER =====================

@api_router.post("/exposure/log")
async def log_exposure(user=Depends(get_current_user), body: dict = {}):
    entry = {
        "exposure_id": str(uuid4()),
        "user_id": user["user_id"],
        "city": body.get("city", ""),
        "aqi": body.get("aqi", 0),
        "duration_minutes": body.get("duration_minutes", 0),
        "level": get_aqi_level(body.get("aqi", 0)),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    supabase.table("exposures").insert(entry).execute()
    return entry

@api_router.get("/exposure/summary")
async def get_exposure_summary(user=Depends(get_current_user)):
    exposures = supabase.table("exposures").select("*").eq("user_id", user["user_id"]).order("timestamp", desc=True).limit(200).execute().data
    today = datetime.now(timezone.utc).date().isoformat()
    today_exposures = [e for e in exposures if e.get("timestamp", "").startswith(today)]
    week_exposures = exposures[:50]

    total_today = sum(e.get("duration_minutes", 0) for e in today_exposures)
    unhealthy_today = sum(e.get("duration_minutes", 0) for e in today_exposures if e.get("aqi", 0) > 100)
    total_week = sum(e.get("duration_minutes", 0) for e in week_exposures)
    unhealthy_week = sum(e.get("duration_minutes", 0) for e in week_exposures if e.get("aqi", 0) > 100)

    return {
        "today": {"total_minutes": total_today, "unhealthy_minutes": unhealthy_today, "entries": len(today_exposures)},
        "week": {"total_minutes": total_week, "unhealthy_minutes": unhealthy_week, "entries": len(week_exposures)},
        "recent": exposures[:10]
    }

# ===================== GAMIFICATION =====================

BADGES = [
    {"id": "clean_air_1", "name": "Clean Air Starter", "desc": "First day with good AQI", "icon": "leaf"},
    {"id": "clean_air_5", "name": "Clean Air Champion", "desc": "5 days avoiding high AQI", "icon": "trophy"},
    {"id": "safe_traveler", "name": "Safe Traveler", "desc": "Planned 3 safe routes", "icon": "navigate"},
    {"id": "health_aware", "name": "Health Aware", "desc": "Completed health profile", "icon": "heart"},
    {"id": "routine_master", "name": "Routine Master", "desc": "Set up 5+ routines", "icon": "time"},
    {"id": "symptom_tracker", "name": "Symptom Tracker", "desc": "Logged symptoms for 7 days", "icon": "pulse"},
    {"id": "city_explorer", "name": "City Explorer", "desc": "Compared 5 cities", "icon": "globe"},
]

@api_router.get("/gamification")
async def get_gamification(user=Depends(get_current_user)):
    uid = user["user_id"]
    activities = supabase.table("activities").select("*").eq("user_id", uid).limit(500).execute().data
    routines = supabase.table("routines").select("*").eq("user_id", uid).limit(100).execute().data
    symptoms = supabase.table("symptoms").select("*").eq("user_id", uid).limit(100).execute().data
    _pr = supabase.table("health_profiles").select("*").eq("user_id", uid).execute()
    profile = ((getattr(_pr, 'data', None) or [None])[0]) or {}

    good_days = len(set(a["timestamp"][:10] for a in activities if a.get("aqi", 999) <= 100))
    travel_plans = len([a for a in activities if a.get("type") == "travel_plan"])

    earned = []
    if good_days >= 1: earned.append("clean_air_1")
    if good_days >= 5: earned.append("clean_air_5")
    if travel_plans >= 3: earned.append("safe_traveler")
    if profile and profile.get("conditions"): earned.append("health_aware")
    if len(routines) >= 5: earned.append("routine_master")
    if len(symptoms) >= 7: earned.append("symptom_tracker")

    streak = 0
    dates = sorted(set(a["timestamp"][:10] for a in activities), reverse=True)
    for i, d in enumerate(dates):
        if i == 0: streak = 1
        elif i > 0:
            from datetime import date as dt_date
            prev = dt_date.fromisoformat(dates[i-1])
            curr = dt_date.fromisoformat(d)
            if (prev - curr).days == 1: streak += 1
            else: break

    return {
        "streak": streak,
        "good_days": good_days,
        "badges": [
            {**b, "earned": b["id"] in earned}
            for b in BADGES
        ],
        "total_activities": len(activities),
        "score": min(100, good_days * 5 + len(routines) * 3 + streak * 2)
    }

# ===================== SYMPTOM INSIGHTS =====================

@api_router.get("/symptoms/insights")
async def get_symptom_insights(user=Depends(get_current_user)):
    symptoms = supabase.table("symptoms").select("*").eq("user_id", user["user_id"]).order("logged_at", desc=True).limit(100).execute().data
    activities = supabase.table("activities").select("*").eq("user_id", user["user_id"]).order("timestamp", desc=True).limit(200).execute().data

    if len(symptoms) < 3:
        return {"insights": [], "message": "Log more symptoms to see patterns (need at least 3 entries)", "has_data": False}

    symptom_aqi_map = {}
    for s in symptoms:
        s_date = s.get("logged_at", "")[:10]
        matching = [a for a in activities if a.get("timestamp", "")[:10] == s_date and a.get("aqi")]
        avg_aqi = sum(a["aqi"] for a in matching) / len(matching) if matching else None
        for sym in s.get("symptoms", []):
            if sym not in symptom_aqi_map: symptom_aqi_map[sym] = []
            if avg_aqi: symptom_aqi_map[sym].append(avg_aqi)

    insights = []
    for sym, aqis in symptom_aqi_map.items():
        if len(aqis) >= 2:
            avg = sum(aqis) / len(aqis)
            insights.append({
                "symptom": sym,
                "avg_aqi_when_reported": round(avg),
                "occurrences": len(aqis),
                "insight": f"Your {sym.lower()} tends to occur when AQI is around {round(avg)}."
                    + (" Consider extra precautions above this level." if avg > 100 else "")
            })

    return {"insights": insights, "has_data": True, "total_symptoms": len(symptoms)}

# ===================== OCR ENDPOINT =====================

def parse_medical_text(text: str) -> dict:
    """Parse raw OCR text into structured medical data."""
    full_text_lower = text.lower()
    lines = [l.strip() for l in text.split('\n') if l.strip()]

    KNOWN_CONDITIONS = [
        'asthma', 'copd', 'diabetes', 'hypertension', 'heart disease',
        'lung disease', 'bronchitis', 'allergies', 'pregnancy', 'arthritis',
        'depression', 'anxiety', 'thyroid', 'anemia', 'obesity', 'cancer',
        'tuberculosis', 'pneumonia', 'sinusitis', 'eczema', 'psoriasis',
    ]
    KNOWN_MEDS = [
        'aspirin', 'ibuprofen', 'paracetamol', 'amoxicillin', 'metformin',
        'atorvastatin', 'omeprazole', 'cetirizine', 'salbutamol', 'insulin',
        'amlodipine', 'lisinopril', 'metoprolol', 'pantoprazole', 'azithromycin',
        'doxycycline', 'prednisone', 'clopidogrel', 'losartan', 'gabapentin',
        'levothyroxine', 'montelukast', 'fluticasone', 'budesonide',
    ]

    conditions = [c.title() for c in KNOWN_CONDITIONS if c in full_text_lower]
    medications = [m.title() for m in KNOWN_MEDS if m in full_text_lower]

    # Extract allergy lines
    allergies = []
    for line in lines:
        if 'allerg' in line.lower() or 'avoid' in line.lower():
            allergies.append(line)

    # Extract dosage / indicator lines (e.g. "BP: 120/80", "Sugar: 180")
    indicators = {}
    for line in lines:
        for kw in ['bp:', 'blood pressure', 'sugar:', 'glucose:', 'cholesterol:', 'weight:', 'bmi:']:
            if kw in line.lower():
                indicators[kw.replace(':', '').title()] = line.strip()

    notes = text[:600].strip() if len(text) > 600 else text.strip()

    return {
        "conditions": list(dict.fromkeys(conditions)),
        "medications": list(dict.fromkeys(medications)),
        "allergies": list(dict.fromkeys(allergies)),
        "indicators": indicators,
        "notes": notes,
    }

@api_router.post("/ocr/prescription")
async def ocr_prescription(req: OCRRequest, user=Depends(get_current_user)):
    try:
        from PIL import Image
        import io

        ocr_api_key = os.environ.get('OCR_SPACE_KEY', 'helloworld')

        # Compress image to stay under 1MB limit
        image_data = b64lib.b64decode(req.image_base64)
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        max_dim = 1200
        w, h = image.size
        if w > max_dim or h > max_dim:
            scale = max_dim / max(w, h)
            image = image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        buffer = io.BytesIO()
        image.save(buffer, format='JPEG', quality=60, optimize=True)
        compressed_b64 = b64lib.b64encode(buffer.getvalue()).decode('utf-8')
        logger.info(f"OCR image compressed: original={len(req.image_base64)} chars, compressed={len(compressed_b64)} chars")

        response = http_requests.post(
            'https://api.ocr.space/parse/image',
            data={
                'apikey': ocr_api_key,
                'base64Image': f'data:image/jpeg;base64,{compressed_b64}',
                'language': 'eng',
                'isOverlayRequired': False,
                'detectOrientation': True,
                'scale': True,
            },
            timeout=60
        )

        result = response.json()
        logger.info(f"OCR.space response for user {user['user_id']}: exitCode={result.get('OCRExitCode')}")

        if result.get('IsErroredOnProcessing'):
            error_msg = result.get('ErrorMessage', ['OCR failed'])[0] if result.get('ErrorMessage') else 'OCR failed'
            raise HTTPException(status_code=500, detail=f"OCR processing failed: {error_msg}")

        parsed_results = result.get('ParsedResults', [])
        if not parsed_results:
            return {"success": True, "extracted": {
                "conditions": [], "medications": [], "allergies": [],
                "indicators": {}, "notes": "No text could be extracted. Try a clearer image."
            }}

        raw_text = parsed_results[0].get('ParsedText', '')
        if not raw_text.strip():
            return {"success": True, "extracted": {
                "conditions": [], "medications": [], "allergies": [],
                "indicators": {}, "notes": "No text found in image. Try a clearer photo."
            }}

        extracted = parse_medical_text(raw_text)
        logger.info(f"OCR success for user {user['user_id']}: {len(extracted['conditions'])} conditions, {len(extracted['medications'])} meds")
        return {"success": True, "extracted": extracted}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OCR error for user {user['user_id']}: {e}")
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")

# ===================== APP SETUP =====================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

