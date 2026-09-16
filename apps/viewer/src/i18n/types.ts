/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

export type TranslationParameter = string | number;
export type TranslationParameters = Readonly<Record<string, TranslationParameter>>;

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
export type PluralTranslation = Readonly<
  { other: string } & Partial<Record<PluralCategory, string>>
>;
export type TranslationValue = string | PluralTranslation;
