export const categoryGroups = [
  { id: "delivery", label: "Доставка", items: [{ id: "courier", label: "Курьер" }, { id: "groceries", label: "Продукты и покупки" }, { id: "documents", label: "Документы и посылки" }] },
  { id: "digital", label: "Цифровые услуги", items: [{ id: "sites", label: "Сайты и приложения" }, { id: "design", label: "Дизайн" }, { id: "photo-video", label: "Фото и видео" }, { id: "text", label: "Тексты и переводы" }] },
  { id: "repair", label: "Ремонт", items: [{ id: "appliances", label: "Бытовая техника" }, { id: "electronics", label: "Телефоны и компьютеры" }, { id: "plumbing", label: "Сантехника" }] },
  { id: "home", label: "Дом и быт", items: [{ id: "furniture", label: "Сборка мебели" }, { id: "help", label: "Помощь по дому" }, { id: "garden", label: "Дача и участок" }] },
  { id: "study", label: "Учёба", items: [{ id: "tutoring", label: "Репетиторство" }, { id: "homework", label: "Помощь с заданиями" }, { id: "languages", label: "Иностранные языки" }] },
  { id: "handyman", label: "Разнорабочие", items: [{ id: "odd-jobs", label: "Разовые работы" }, { id: "assembly", label: "Сборка и установка" }, { id: "outdoor", label: "Работы на улице" }] },
  { id: "moving", label: "Переезды и грузчики", items: [{ id: "loaders", label: "Грузчики" }, { id: "moving", label: "Переезд" }, { id: "transport", label: "Перевозка вещей" }] },
  { id: "cleaning", label: "Уборка", items: [{ id: "home", label: "Уборка квартиры" }, { id: "office", label: "Уборка офиса" }, { id: "windows", label: "Мойка окон" }] },
  { id: "construction", label: "Строительство", items: [{ id: "finishing", label: "Отделка" }, { id: "electrical", label: "Электрика" }, { id: "painting", label: "Покраска" }] },
  { id: "beauty", label: "Красота", items: [{ id: "hair", label: "Волосы" }, { id: "makeup", label: "Макияж" }, { id: "nails", label: "Маникюр" }] },
  { id: "fitness", label: "Спорт", items: [{ id: "coach", label: "Тренер" }, { id: "classes", label: "Занятия" }, { id: "wellness", label: "Здоровый образ жизни" }] },
  { id: "pets", label: "Животные", items: [{ id: "walking", label: "Выгул" }, { id: "sitting", label: "Передержка" }, { id: "care", label: "Уход" }] },
  { id: "auto", label: "Авто", items: [{ id: "wash", label: "Мойка" }, { id: "help", label: "Помощь с автомобилем" }, { id: "driver", label: "Водитель" }] },
  { id: "events", label: "Мероприятия", items: [{ id: "host", label: "Ведущий" }, { id: "photo", label: "Съёмка" }, { id: "setup", label: "Подготовка площадки" }] },
  { id: "other", label: "Другое", items: [{ id: "errands", label: "Поручения" }, { id: "consulting", label: "Консультации" }, { id: "misc", label: "Другая помощь" }] },
] as const;

export function categoryLabel(value: string) {
  const [groupId, itemId] = value.split(":");
  const group = categoryGroups.find((item) => item.id === groupId);
  return group?.items.find((item) => item.id === itemId)?.label || group?.label || "Другое";
}

export function validCategory(value: string) {
  const parts = value.split(":");
  if (parts.length > 2) return false;
  const [groupId, itemId] = parts;
  const group = categoryGroups.find((item) => item.id === groupId);
  return !!group && (!itemId || group.items.some((item) => item.id === itemId));
}
