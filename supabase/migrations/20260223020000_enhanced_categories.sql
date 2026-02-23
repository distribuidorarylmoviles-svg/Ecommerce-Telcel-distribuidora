-- Add description and image_url to categories
alter table public.categories 
add column if not exists description text,
add column if not exists image_url text;
