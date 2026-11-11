import test from 'node:test';
import assert from 'node:assert/strict';
import { noteTagTokens, prefixNoteTags } from './actual-note-tags.mjs';

for(const [notes,expected] of [
 ['Coffee #Trip\nhttps://mail.google.com/mail/u/0/#all/abc123','#Trip\nCoffee\nhttps://mail.google.com/mail/u/0/#all/abc123'],
 ['#Trip\nCoffee\n#café #Running-2026\nsource=manual:coffee','#Trip #café #Running-2026\nCoffee\nsource=manual:coffee'],
 ['  #Trip  Coffee  details  #Tag  \nUntouched  spaces\n','#Trip #Tag\nCoffee  details\nUntouched  spaces\n'],
 ['Coffee (#Trip).\n#2026','#Trip #2026\nCoffee ().\n'],
 ['#Trip\nCoffee','#Trip\nCoffee'],['#Trip','#Trip'],['Coffee\n','Coffee\n'],['',''],
 ['https://example.test/#Trip\nsource=manual:x#Tag\nrefundOf=x#Trip','https://example.test/#Trip\nsource=manual:x#Tag\nrefundOf=x#Trip'],
 ['Coffee.https://mail.google.com/mail/u/0/#all/abc123#Trip','Coffee.https://mail.google.com/mail/u/0/#all/abc123#Trip'],
 ['word#Trip ##Trip a-#Trip a_#Trip','word#Trip ##Trip a-#Trip a_#Trip'],
 ['Coffee\r\n#Trip\r\nhttps://example.test/#fragment','#Trip\nCoffee\r\nhttps://example.test/#fragment'],
])test('prefix formatting: '+JSON.stringify(notes),()=>{
 assert.equal(prefixNoteTags(notes),expected);
 assert.equal(prefixNoteTags(expected),expected,'Formatting is idempotent');
});
test('token positions and case preserve complete Unicode spelling',()=>{
 const notes='Coffee #café #Trip-extra #Trip2\nhttps://example.test/#Trip';
 assert.deepEqual(noteTagTokens(notes).map(t=>[t.tag,notes.slice(t.start,t.end)]),[['#café','#café'],['#Trip-extra','#Trip-extra'],['#Trip2','#Trip2']]);
});
for(const notes of ['#Trip Coffee #trip','#CAFÉ\n#café','#Trip #trip\nhttps://example.test/#Trip'])test('duplicates require review: '+notes,()=>{
 assert.throws(()=>prefixNoteTags(notes),/Duplicate tag/);
});
for(const notes of ['Purchase #Trip#Other','Purchase #Trip#trip','Purchase #Trip#'])test('glued hashtags require review without partial relocation: '+notes,()=>{
 assert.throws(()=>prefixNoteTags(notes),/Ambiguous glued hashtag/);
});
