UPDATE auth.identities
SET identity_data = jsonb_set(identity_data, '{email}', '"l7hmarque@gmail.com"'),
    updated_at = now()
WHERE provider = 'email'
  AND user_id = (SELECT id FROM auth.users WHERE email = 'leo@syselo.com' LIMIT 1);

UPDATE auth.users
SET email = 'l7hmarque@gmail.com',
    encrypted_password = crypt('p60506924', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = 'leo@syselo.com';