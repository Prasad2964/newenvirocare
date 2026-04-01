"""
EnviroCare AI Backend API Tests
Tests: Auth (signup, login, me), AQI endpoints, Health Profile, Routines, Travel, Risk Assessment
"""
import pytest
import requests
import os
from uuid import uuid4

# Read from frontend .env file
try:
    with open('/app/frontend/.env', 'r') as f:
        for line in f:
            if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
                break
        else:
            BASE_URL = ''
except:
    BASE_URL = ''

if not BASE_URL:
    raise Exception("EXPO_PUBLIC_BACKEND_URL not found in /app/frontend/.env")

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def test_user_email():
    """Generate unique test user email"""
    return f"test_{uuid4().hex[:8]}@envirocare.test"

@pytest.fixture
def auth_token(api_client, test_user_email):
    """Create test user and return auth token"""
    # Signup
    signup_data = {
        "name": "Test User",
        "email": test_user_email,
        "password": "testpass123"
    }
    signup_resp = api_client.post(f"{BASE_URL}/api/auth/signup", json=signup_data)
    assert signup_resp.status_code == 200, f"Signup failed: {signup_resp.text}"
    
    # Login
    login_resp = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": test_user_email,
        "password": "testpass123"
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token = login_resp.json()["token"]
    
    yield token
    
    # Cleanup: delete account
    try:
        api_client.delete(
            f"{BASE_URL}/api/auth/account",
            headers={"Authorization": f"Bearer {token}"}
        )
    except:
        pass

class TestHealthCheck:
    """API health check tests"""
    
    def test_api_root(self, api_client):
        """Test API root endpoint"""
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data
        print("✓ API health check passed")


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_signup_success(self, api_client, test_user_email):
        """Test successful user signup"""
        response = api_client.post(f"{BASE_URL}/api/auth/signup", json={
            "name": "New User",
            "email": test_user_email,
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "message" in data
        print("✓ Signup success test passed")
    
    def test_signup_duplicate_email(self, api_client, auth_token, test_user_email):
        """Test signup with existing email"""
        response = api_client.post(f"{BASE_URL}/api/auth/signup", json={
            "name": "Duplicate",
            "email": test_user_email,
            "password": "pass123"
        })
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()
        print("✓ Duplicate email validation passed")
    
    def test_login_success(self, api_client, auth_token, test_user_email):
        """Test successful login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_user_email,
            "password": "testpass123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == test_user_email
        print("✓ Login success test passed")
    
    def test_login_invalid_credentials(self, api_client, test_user_email):
        """Test login with wrong password"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_user_email,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()
        print("✓ Invalid credentials test passed")
    
    def test_get_me(self, api_client, auth_token):
        """Test get current user endpoint"""
        response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "name" in data
        assert "email" in data
        print("✓ Get me test passed")
    
    def test_get_me_no_auth(self, api_client):
        """Test get me without authentication"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ Auth required test passed")


class TestAQIEndpoints:
    """AQI data endpoint tests"""
    
    def test_get_city_aqi(self, api_client):
        """Test AQI data for a city"""
        response = api_client.get(f"{BASE_URL}/api/aqi/Mumbai")
        assert response.status_code == 200
        data = response.json()
        assert "city" in data
        assert "aqi" in data
        assert "level" in data
        assert "weather" in data
        assert "pollutants" in data
        assert "mask" in data
        assert data["city"] == "Mumbai"
        assert isinstance(data["aqi"], int)
        print(f"✓ Get city AQI test passed (Mumbai AQI: {data['aqi']})")
    
    def test_compare_cities(self, api_client):
        """Test city comparison endpoint"""
        response = api_client.post(f"{BASE_URL}/api/aqi/compare", json={
            "city1": "Delhi",
            "city2": "Bangalore"
        })
        assert response.status_code == 200
        data = response.json()
        assert "city1" in data
        assert "city2" in data
        assert data["city1"]["city"] == "Delhi"
        assert data["city2"]["city"] == "Bangalore"
        assert "aqi" in data["city1"]
        assert "aqi" in data["city2"]
        print(f"✓ City comparison test passed (Delhi: {data['city1']['aqi']}, Bangalore: {data['city2']['aqi']})")


class TestHealthProfile:
    """Health profile CRUD tests"""
    
    def test_create_health_profile(self, api_client, auth_token):
        """Test creating health profile"""
        profile_data = {
            "conditions": ["Asthma", "Allergies"],
            "medications": ["Inhaler", "Antihistamine"],
            "age": 30,
            "blood_group": "O+",
            "allergies": ["Pollen", "Dust"]
        }
        response = api_client.post(
            f"{BASE_URL}/api/health-profile",
            json=profile_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "profile" in data
        assert data["profile"]["conditions"] == profile_data["conditions"]
        print("✓ Create health profile test passed")
    
    def test_get_health_profile(self, api_client, auth_token):
        """Test getting health profile"""
        # First create
        api_client.post(
            f"{BASE_URL}/api/health-profile",
            json={"conditions": ["COPD"], "medications": []},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Then get
        response = api_client.get(
            f"{BASE_URL}/api/health-profile",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "conditions" in data
        assert "COPD" in data["conditions"]
        print("✓ Get health profile test passed")
    
    def test_update_health_profile(self, api_client, auth_token):
        """Test updating health profile"""
        # Create
        api_client.post(
            f"{BASE_URL}/api/health-profile",
            json={"conditions": ["Asthma"]},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Update
        response = api_client.post(
            f"{BASE_URL}/api/health-profile",
            json={"conditions": ["Asthma", "Diabetes"], "age": 35},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        # Verify
        get_resp = api_client.get(
            f"{BASE_URL}/api/health-profile",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = get_resp.json()
        assert "Diabetes" in data["conditions"]
        assert data["age"] == 35
        print("✓ Update health profile test passed")


class TestRiskAssessment:
    """Risk assessment endpoint tests"""
    
    def test_risk_assessment_no_conditions(self, api_client, auth_token):
        """Test risk assessment without health conditions"""
        response = api_client.post(
            f"{BASE_URL}/api/risk-assessment",
            json={"city": "Mumbai"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "aqi" in data
        assert "risk" in data
        assert "advice" in data
        assert "mask" in data
        assert "score" in data["risk"]
        assert "level" in data["risk"]
        print(f"✓ Risk assessment (no conditions) test passed (Risk: {data['risk']['level']})")
    
    def test_risk_assessment_with_conditions(self, api_client, auth_token):
        """Test risk assessment with health conditions"""
        # Create health profile with conditions
        api_client.post(
            f"{BASE_URL}/api/health-profile",
            json={"conditions": ["Asthma", "COPD"]},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        response = api_client.post(
            f"{BASE_URL}/api/risk-assessment",
            json={"city": "Delhi"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "risk" in data
        assert data["risk"]["score"] > 0
        assert len(data["risk"]["affected_conditions"]) > 0
        print(f"✓ Risk assessment (with conditions) test passed (Score: {data['risk']['score']})")


class TestRoutines:
    """Routine management tests"""
    
    def test_create_routine(self, api_client, auth_token):
        """Test creating a routine"""
        routine_data = {
            "activity": "Morning Walk",
            "time": "07:00 AM",
            "type": "outdoor",
            "days": ["Mon", "Wed", "Fri"]
        }
        response = api_client.post(
            f"{BASE_URL}/api/routines",
            json=routine_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "routine_id" in data
        assert data["activity"] == routine_data["activity"]
        assert data["time"] == routine_data["time"]
        print("✓ Create routine test passed")
    
    def test_get_routines(self, api_client, auth_token):
        """Test getting all routines"""
        # Create a routine first
        api_client.post(
            f"{BASE_URL}/api/routines",
            json={"activity": "Gym", "time": "06:00 PM", "type": "indoor"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        response = api_client.get(
            f"{BASE_URL}/api/routines",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert "activity" in data[0]
        print(f"✓ Get routines test passed ({len(data)} routines)")
    
    def test_delete_routine(self, api_client, auth_token):
        """Test deleting a routine"""
        # Create
        create_resp = api_client.post(
            f"{BASE_URL}/api/routines",
            json={"activity": "Jogging", "time": "06:30 AM", "type": "outdoor"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        routine_id = create_resp.json()["routine_id"]
        
        # Delete
        response = api_client.delete(
            f"{BASE_URL}/api/routines/{routine_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        # Verify deleted
        get_resp = api_client.get(
            f"{BASE_URL}/api/routines",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        routines = get_resp.json()
        routine_ids = [r["routine_id"] for r in routines]
        assert routine_id not in routine_ids
        print("✓ Delete routine test passed")
    
    def test_ai_adjust_routines(self, api_client, auth_token):
        """Test AI routine adjustments"""
        # Create a routine
        api_client.post(
            f"{BASE_URL}/api/routines",
            json={"activity": "Morning Run", "time": "07:00 AM", "type": "outdoor"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        response = api_client.post(
            f"{BASE_URL}/api/routines/ai-adjust",
            json={"city": "Delhi"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "adjustments" in data
        assert "aqi" in data
        assert "ai_summary" in data
        assert len(data["adjustments"]) > 0
        print(f"✓ AI adjust routines test passed (Summary: {data['ai_summary'][:50]}...)")


class TestTravel:
    """Travel planning tests"""
    
    def test_plan_travel(self, api_client, auth_token):
        """Test travel planning endpoint"""
        response = api_client.post(
            f"{BASE_URL}/api/travel/plan",
            json={"origin": "Pune", "destination": "Mumbai", "mode": "car"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "origin" in data
        assert "destination" in data
        assert "origin_risk" in data
        assert "destination_risk" in data
        assert "travel_advice" in data
        assert "precautions" in data
        assert data["origin"]["city"] == "Pune"
        assert data["destination"]["city"] == "Mumbai"
        print(f"✓ Travel planning test passed (Advice: {data['travel_advice'][:50]}...)")


class TestSymptoms:
    """Symptom logging tests"""
    
    def test_log_symptom(self, api_client, auth_token):
        """Test logging symptoms"""
        response = api_client.post(
            f"{BASE_URL}/api/symptoms",
            json={"symptoms": ["Headache", "Dry eyes"], "severity": 6, "notes": "After morning walk"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "symptom_id" in data
        assert "symptoms" in data
        assert "Headache" in data["symptoms"]
        print("✓ Log symptom test passed")
    
    def test_get_symptoms(self, api_client, auth_token):
        """Test getting symptom history"""
        # Log a symptom first
        api_client.post(
            f"{BASE_URL}/api/symptoms",
            json={"symptoms": ["Cough"], "severity": 5},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        response = api_client.get(
            f"{BASE_URL}/api/symptoms",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ Get symptoms test passed ({len(data)} entries)")


class TestHealthReport:
    """Health report tests"""
    
    def test_get_health_report(self, api_client, auth_token):
        """Test getting health report"""
        # Log some symptoms
        api_client.post(
            f"{BASE_URL}/api/symptoms",
            json={"symptoms": ["Headache"], "severity": 5},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        response = api_client.get(
            f"{BASE_URL}/api/health-report",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_symptom_logs" in data
        assert "symptom_frequency" in data
        assert "summary" in data
        print("✓ Health report test passed")


class TestSettings:
    """User settings tests (NEW in iteration 2)"""
    
    def test_save_settings(self, api_client, auth_token):
        """Test saving user settings"""
        settings_data = {
            "safe_aqi_threshold": 50,
            "risky_aqi_threshold": 150,
            "dangerous_aqi_threshold": 300,
            "notify_daily_updates": True,
            "notify_high_risk": True,
            "notify_travel": False,
            "notify_routine": True,
            "default_city": "Delhi"
        }
        response = api_client.post(
            f"{BASE_URL}/api/settings",
            json=settings_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "settings" in data
        assert data["settings"]["default_city"] == "Delhi"
        print("✓ Save settings test passed")
    
    def test_get_settings(self, api_client, auth_token):
        """Test getting user settings with defaults"""
        response = api_client.get(
            f"{BASE_URL}/api/settings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "safe_aqi_threshold" in data
        assert "risky_aqi_threshold" in data
        assert "dangerous_aqi_threshold" in data
        assert "notify_daily_updates" in data
        assert "default_city" in data
        print("✓ Get settings test passed")


class TestActivities:
    """Activity history tests (NEW in iteration 2)"""
    
    def test_log_activity(self, api_client, auth_token):
        """Test logging user activity"""
        activity_data = {
            "type": "aqi_check",
            "city": "Mumbai",
            "aqi": 110,
            "risk_level": "medium",
            "description": "AQI 110 - moderate"
        }
        response = api_client.post(
            f"{BASE_URL}/api/activity",
            json=activity_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "activity_id" in data
        assert data["city"] == "Mumbai"
        assert data["aqi"] == 110
        print("✓ Log activity test passed")
    
    def test_get_activities(self, api_client, auth_token):
        """Test getting activity history"""
        # Log an activity first
        api_client.post(
            f"{BASE_URL}/api/activity",
            json={"type": "aqi_check", "city": "Bangalore", "aqi": 68},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        response = api_client.get(
            f"{BASE_URL}/api/activities",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ Get activities test passed ({len(data)} activities)")


class TestNotifications:
    """Notification system tests (NEW in iteration 2)"""
    
    def test_log_notification(self, api_client, auth_token):
        """Test logging a notification"""
        notif_data = {
            "type": "alert",
            "title": "High AQI Alert",
            "message": "AQI in Mumbai is 180. Stay indoors."
        }
        response = api_client.post(
            f"{BASE_URL}/api/notifications/log",
            json=notif_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "notification_id" in data
        assert data["title"] == notif_data["title"]
        assert data["read"] == False
        print("✓ Log notification test passed")
    
    def test_get_notifications(self, api_client, auth_token):
        """Test getting notifications"""
        # Log a notification first
        api_client.post(
            f"{BASE_URL}/api/notifications/log",
            json={"type": "alert", "title": "Test Alert", "message": "Test message"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        response = api_client.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ Get notifications test passed ({len(data)} notifications)")
    
    def test_mark_notification_read(self, api_client, auth_token):
        """Test marking notification as read"""
        # Log a notification
        log_resp = api_client.post(
            f"{BASE_URL}/api/notifications/log",
            json={"type": "info", "title": "Info", "message": "Test"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        notif_id = log_resp.json()["notification_id"]
        
        # Mark as read
        response = api_client.post(
            f"{BASE_URL}/api/notifications/read/{notif_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        assert "message" in response.json()
        print("✓ Mark notification read test passed")


class TestTravelHotspots:
    """Travel hotspots tests (NEW in iteration 2)"""
    
    def test_get_travel_hotspots(self, api_client, auth_token):
        """Test getting travel route hotspots"""
        hotspot_data = {
            "origin": "Pune",
            "destination": "Mumbai"
        }
        response = api_client.post(
            f"{BASE_URL}/api/travel/hotspots",
            json=hotspot_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "origin" in data
        assert "destination" in data
        assert "hotspots" in data
        assert "high_risk_count" in data
        assert data["origin"]["name"] == "Pune"
        assert data["destination"]["name"] == "Mumbai"
        assert isinstance(data["hotspots"], list)
        assert len(data["hotspots"]) > 0
        print(f"✓ Travel hotspots test passed ({len(data['hotspots'])} hotspots, {data['high_risk_count']} high-risk)")


class TestExposureTracker:
    """Exposure tracker tests (NEW in iteration 4)"""
    
    def test_log_exposure(self, api_client, auth_token):
        """Test logging air exposure"""
        exposure_data = {
            "city": "Mumbai",
            "aqi": 120,
            "duration_minutes": 45
        }
        response = api_client.post(
            f"{BASE_URL}/api/exposure/log",
            json=exposure_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "exposure_id" in data
        assert data["city"] == "Mumbai"
        assert data["aqi"] == 120
        assert data["duration_minutes"] == 45
        assert "level" in data
        assert "timestamp" in data
        print(f"✓ Log exposure test passed (Exposure ID: {data['exposure_id']})")
    
    def test_get_exposure_summary(self, api_client, auth_token):
        """Test getting exposure summary"""
        # Log some exposures first
        api_client.post(
            f"{BASE_URL}/api/exposure/log",
            json={"city": "Delhi", "aqi": 180, "duration_minutes": 30},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        api_client.post(
            f"{BASE_URL}/api/exposure/log",
            json={"city": "Mumbai", "aqi": 90, "duration_minutes": 60},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        response = api_client.get(
            f"{BASE_URL}/api/exposure/summary",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "today" in data
        assert "week" in data
        assert "recent" in data
        assert "total_minutes" in data["today"]
        assert "unhealthy_minutes" in data["today"]
        assert "entries" in data["today"]
        assert isinstance(data["recent"], list)
        print(f"✓ Exposure summary test passed (Today: {data['today']['total_minutes']}m, Week: {data['week']['total_minutes']}m)")


class TestGamification:
    """Gamification tests (NEW in iteration 4)"""
    
    def test_get_gamification(self, api_client, auth_token):
        """Test getting gamification data"""
        # Create some data for gamification
        api_client.post(
            f"{BASE_URL}/api/activity",
            json={"type": "aqi_check", "city": "Mumbai", "aqi": 80},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        api_client.post(
            f"{BASE_URL}/api/routines",
            json={"activity": "Morning Walk", "time": "07:00 AM", "type": "outdoor"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        response = api_client.get(
            f"{BASE_URL}/api/gamification",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "streak" in data
        assert "good_days" in data
        assert "badges" in data
        assert "total_activities" in data
        assert "score" in data
        assert isinstance(data["badges"], list)
        assert len(data["badges"]) > 0
        # Check badge structure
        badge = data["badges"][0]
        assert "id" in badge
        assert "name" in badge
        assert "desc" in badge
        assert "icon" in badge
        assert "earned" in badge
        print(f"✓ Gamification test passed (Streak: {data['streak']}, Score: {data['score']}, Badges: {len(data['badges'])})")


class TestSymptomInsights:
    """Symptom insights tests (NEW in iteration 4)"""
    
    def test_symptom_insights_insufficient_data(self, api_client, auth_token):
        """Test symptom insights with insufficient data"""
        response = api_client.get(
            f"{BASE_URL}/api/symptoms/insights",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "insights" in data
        assert "has_data" in data
        assert "message" in data
        assert data["has_data"] == False
        print("✓ Symptom insights (insufficient data) test passed")
    
    def test_symptom_insights_with_data(self, api_client, auth_token):
        """Test symptom insights with sufficient data"""
        # Log symptoms and activities
        for i in range(5):
            api_client.post(
                f"{BASE_URL}/api/symptoms",
                json={"symptoms": ["Headache", "Cough"], "severity": 6},
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            api_client.post(
                f"{BASE_URL}/api/activity",
                json={"type": "aqi_check", "city": "Delhi", "aqi": 150 + i * 10},
                headers={"Authorization": f"Bearer {auth_token}"}
            )
        
        response = api_client.get(
            f"{BASE_URL}/api/symptoms/insights",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "insights" in data
        assert "has_data" in data
        assert "total_symptoms" in data
        if data["has_data"]:
            assert isinstance(data["insights"], list)
            if len(data["insights"]) > 0:
                insight = data["insights"][0]
                assert "symptom" in insight
                assert "avg_aqi_when_reported" in insight
                assert "occurrences" in insight
                assert "insight" in insight
        print(f"✓ Symptom insights test passed (Has data: {data['has_data']}, Total symptoms: {data['total_symptoms']})")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
