import { describe, expect, it } from 'vitest';
import { LIBRARIES } from './icon-library';

const nameOf = (pkg: string, file: string) => LIBRARIES.find((lib) => lib.pkg === pkg)!.nameOf(file);

describe('nameOf', () => {
  it('drops the .es.js suffix phosphor ships', () => {
    expect(nameOf('@phosphor-icons/react', 'ArrowRight.es.js')).toBe('arrow-right');
  });

  it('keeps names of the other packages', () => {
    expect(nameOf('lucide-react', 'arrow-right.mjs')).toBe('arrow-right');
    expect(nameOf('@heroicons/react', 'ArrowRightIcon.js')).toBe('arrow-right');
    expect(nameOf('@tabler/icons-react', 'IconArrowRight.mjs')).toBe('arrow-right');
  });
});
