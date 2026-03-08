import he from 'he';

export function htmlDecode(str: string): string {
  return he.decode(str);
}
