import os
import time
import requests
import psycopg2
from datetime import datetime, timedelta

# Environment Variables
DB_HOST = os.getenv("DB_HOST", "db.wzlkoxtcybvlpmoriguv.supabase.co")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASSWORD", "Kamehamehamehaa@12341911")  # Used for direct psycopg2 connect

ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://localhost:8085")

def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )

def renew_active_policies():
    print(f"[{datetime.now()}] 🔄 Starting weekly auto-renewal script...")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Find policies expiring in the next 24 hours
        cursor.execute("""
            SELECT id, user_id, policy_id, coverage_limit 
            FROM user_policies 
            WHERE status = 'active' 
            AND end_date < NOW() + INTERVAL '1 day'
        """)
        expiring_policies = cursor.fetchall()
        print(f"   Found {len(expiring_policies)} policies up for renewal.")
        
        for p in expiring_policies:
            policy_id_pk, user_id, plan_id, coverage_limit = p
            
            # Fetch user details (zone, income baseline)
            cursor.execute("SELECT work_zone FROM users WHERE id = %s", (user_id,))
            user_row = cursor.fetchone()
            if not user_row:
                continue
            work_zone = user_row[0]
            
            # For demo, default expected income
            expected_income = 1500.0 
            
            # 1. Fetch live risk from ML service
            # We first try to get the lat/lng from user_locations to pass to /risk/location
            cursor.execute("SELECT lat, lng FROM user_locations WHERE user_id = %s ORDER BY recorded_at DESC LIMIT 1", (user_id,))
            loc_row = cursor.fetchone()
            
            risk_score = 0.5
            plan_name = "GOLD"
            if plan_id == "policy_01": plan_name = "SILVER"
            elif plan_id == "policy_03": plan_name = "PLATINUM"
            
            try:
                premium_request = {
                    "expected_weekly_income": expected_income,
                    "coverage_multiplier": 0.5 if plan_name == "SILVER" else (0.8 if plan_name == "GOLD" else 1.0),
                    "risk_score": risk_score,
                    "plan": plan_name
                }
                
                resp = requests.post(f"{ML_SERVICE_URL}/premium/calculate", json=premium_request)
                if resp.status_code == 200:
                    premium_data = resp.json()
                    calculated_premium = premium_data.get("total_premium", 120.0)
                else:
                    calculated_premium = 120.0 # fallback
            except Exception as e:
                print(f"   ⚠️ ML calculation failed: {e}")
                calculated_premium = 120.0
                
            # 2. Simulate Razorpay Deduction
            tx_id = f"pay_{int(time.time())}_RAZORPAY_RENEW"
            print(f"   💳 [RAZORPAY SIM] Deducted ₹{calculated_premium} for user {user_id}. TxID: {tx_id}")
            
            # 3. Create new user_policy row for the next 7 days
            start_date = datetime.now()
            end_date = start_date + timedelta(days=7)
            
            cursor.execute("""
                INSERT INTO user_policies (user_id, policy_id, status, start_date, end_date, premium_paid, coverage_limit, created_at, updated_at)
                VALUES (%s, %s, 'active', %s, %s, %s, %s, NOW(), NOW())
            """, (user_id, plan_id, start_date, end_date, calculated_premium, coverage_limit))
            
            # Mark old policy as expired
            cursor.execute("""
                UPDATE user_policies SET status = 'expired', updated_at = NOW() WHERE id = %s
            """, (policy_id_pk,))
            
        conn.commit()
        print(f"[{datetime.now()}] ✅ Auto-renewal complete.")
        
    except Exception as e:
        print(f"❌ Error during renewal: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    print("🚀 Auto-renewal process started.")
    # Loop and run once every 7 days (or currently checking every 1 hour for demo)
    while True:
        renew_active_policies()
        # For production use 24 hours: 86400
        # Wait 1 hour between checks
        print("💤 Sleeping for 1 hour...")
        time.sleep(3600)
