// AI dish-photo domain (spec/logic/ai-dish-photo-macros.md, B-118). Pure prompt assembly +
// response parsing; no I/O, no user scope.
export { DISH_PHOTO_FORMAT_INSTRUCTION } from './format.js';
export { buildDishPhotoMessages } from './assemble.js';
export type { ChatMessage, ChatContentPart } from './assemble.js';
export { parseDishPhotoResult } from './parse.js';
export type { DishPhotoParseResult } from './parse.js';
