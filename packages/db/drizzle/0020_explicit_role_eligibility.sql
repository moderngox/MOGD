-- An empty allowedSessionRoles used to mean "not configured yet" and was silently
-- treated as accessory-only. Make that explicit data: every exercise must list at
-- least one role. Empty already behaved as accessory-only, so this changes no
-- generated program. Safe to re-run; configured lists are untouched.
UPDATE `exercise` SET `allowedSessionRoles` = '["accessory"]' WHERE `allowedSessionRoles` = '[]';
