set lock_timeout = '5s';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'brand_fonts_org_font_fk') then
    alter table public.brand_fonts
      add constraint brand_fonts_org_font_fk foreign key (org_font_id) references public.org_fonts(id) on delete cascade;
  end if;
end $$;
