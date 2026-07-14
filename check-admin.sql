SELECT name, email, role, status, telegram_id, telegram_verified
FROM "User"
WHERE role IN ('super_admin', 'admin')
ORDER BY created_at DESC;
