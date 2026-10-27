import { describe, expect, it } from 'vitest';
import { figmaUrl } from './file-url';

describe('a figma.com link', () => {
  it('names the file and no frame when it points at the file', () => {
    expect(figmaUrl('https://www.figma.com/design/AbCdEf1234567890/My-file?t=x')).toEqual({ fileKey: 'AbCdEf1234567890', nodeId: null });
  });

  it('reads the older /file/ links too', () => {
    expect(figmaUrl('https://figma.com/file/AbCdEf1234567890/My-file')?.fileKey).toBe('AbCdEf1234567890');
  });

  it('turns the node-id of the link into the id the API uses', () => {
    expect(figmaUrl('https://www.figma.com/design/AbCdEf1234567890/F?node-id=12-345')).toEqual({ fileKey: 'AbCdEf1234567890', nodeId: '12:345' });
  });

  it('refuses another host, a missing key and text that is no link', () => {
    expect(figmaUrl('https://evil.example/design/AbCdEf1234567890/F')).toBeNull();
    expect(figmaUrl('https://www.figma.com/community/plugin/1')).toBeNull();
    expect(figmaUrl('not a link')).toBeNull();
  });

  it('refuses a host that only starts like figma.com', () => {
    expect(figmaUrl('https://figma.com.evil.example/design/AbCdEf1234567890/F')).toBeNull();
  });
});
