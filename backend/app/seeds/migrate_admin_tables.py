import sqlite3

def run_migration():
    conn = sqlite3.connect('sg4dmyanmar.db')
    cursor = conn.cursor()

    # 1. Create system_settings table if not exists
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wave_phone VARCHAR(50) DEFAULT '09894169717',
        wave_name VARCHAR(100) DEFAULT 'Ye Win Htut',
        wave_qr_url VARCHAR(255) DEFAULT '/assets/wave_qr_sample.png',
        kpay_phone VARCHAR(50) DEFAULT '09798888888',
        kpay_name VARCHAR(100) DEFAULT 'Daw Hla Hla',
        kpay_qr_url VARCHAR(255) DEFAULT '/assets/kpay_qr_sample.png',
        bet_end_time VARCHAR(20) DEFAULT '04:30 PM',
        result_confirm_time VARCHAR(20) DEFAULT '06:00 PM',
        consecutive_reward_percent FLOAT DEFAULT 20.0,
        min_amount_per_bet FLOAT DEFAULT 50.0,
        max_amount_per_bet FLOAT DEFAULT 10000.0,
        max_amount_per_slip FLOAT DEFAULT 100000.0,
        max_amount_per_number FLOAT DEFAULT 11000.0,
        default_bet_amount FLOAT DEFAULT 100.0,
        company_balance_oct FLOAT DEFAULT 4198200.0,
        updated_at DATETIME
    )
    ''')

    # 2. Create application_releases table if not exists
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS application_releases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) NOT NULL,
        build_number INTEGER NOT NULL,
        version VARCHAR(30) NOT NULL,
        apk_url VARCHAR(255),
        created_at DATETIME
    )
    ''')

    # 3. Add columns to users table if missing
    def add_col(tbl, col, typ):
        try:
            cursor.execute(f'ALTER TABLE {tbl} ADD COLUMN {col} {typ}')
            print(f'Added {col} to {tbl}')
        except Exception:
            pass

    add_col('users', 'nickname', 'VARCHAR(100)')
    add_col('users', 'avatar_url', 'VARCHAR(255)')
    add_col('users', 'is_suspended', 'BOOLEAN DEFAULT 0')
    add_col('users', 'level', "VARCHAR(20) DEFAULT 'Level 1'")
    add_col('users', 'has_commission', 'BOOLEAN DEFAULT 0')

    # 4. Add columns to notifications table if missing
    add_col('notifications', 'category', "VARCHAR(40) DEFAULT 'Announcement'")

    conn.commit()
    conn.close()
    print('SQLite migration completed successfully!')

if __name__ == '__main__':
    run_migration()
