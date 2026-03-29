import { FlyingTrait } from './flying.js';
import { VampireTrait } from './vampire.js';

export { FlyingTrait, VampireTrait };

export const TRAIT_DEFINITIONS = Object.freeze([
  { id: VampireTrait.id, label: 'Vampire', trait: VampireTrait },
  { id: FlyingTrait.id, label: 'Flying', trait: FlyingTrait },
]);

export function getTraitDefinitionById(traitId) {
  return TRAIT_DEFINITIONS.find((definition) => definition.id === traitId) ?? null;
}
