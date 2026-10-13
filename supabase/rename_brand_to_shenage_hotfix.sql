-- Update only the public legal privacy copy stored in production settings.
-- The application reads this value through get_public_app_settings().

update public.platform_settings
set
  value_json = jsonb_set(
    coalesce(value_json, '{}'::jsonb),
    '{privacyRules}',
    to_jsonb(
      'შენაგე ამუშავებს მხოლოდ სერვისის გასაწევად აუცილებელ პირად მონაცემებს. ჯავშნისა და მხარდაჭერის პროცესში საჭირო ინფორმაცია ხელმისაწვდომია მხოლოდ შესაბამისი პროცესის მონაწილეებისთვის და პლატფორმის ფუნქციონირების ფარგლებში. ძირითადი კომუნიკაცია ჩატში რჩება.'::text
    ),
    true
  ),
  updated_at = now()
where key = 'legal';

notify pgrst, 'reload schema';
