UPDATE auth.users
SET encrypted_password = crypt('leop60506924', gen_salt('bf')),
    updated_at = now()
WHERE email = 'l7hmarque@gmail.com';