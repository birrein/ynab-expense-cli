import assert from 'node:assert/strict';

// URLs (including every fragment) and provenance lines are indivisible metadata.
export function noteTagTokens(notes){
 const prose=notes.replace(/https?:\/\/\S+|^[\t ]*(?:source|refundOf)\s*=.*$/gim,m=>' '.repeat(m.length));
 return [...prose.matchAll(/(?<![\p{L}\p{N}\p{M}_#-])#[\p{L}\p{N}\p{M}_-]+/gu)]
  .map(m=>{
   // Do not split glued sequences: moving the first partial match can expose
   // another token or even manufacture a duplicate on the next pass.
   const end=m.index+m[0].length;
   assert.notEqual(prose[end],'#','Ambiguous glued hashtag tokens require review');
   return {tag:m[0],start:m.index,end};
  });
}

export function prefixNoteTags(notes){
 const tokens=noteTagTokens(notes);
 if(!tokens.length)return notes;
 const names=tokens.map(t=>t.tag.toLowerCase());
 assert.equal(new Set(names).size,names.length,'Duplicate tag occurrences require review');
 const body=[];
 for(const m of notes.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)){
  if(!m[0])continue;
  const tags=tokens.filter(t=>t.start>=m.index&&t.start<m.index+m[1].length);
  if(!tags.length){body.push(m[0]);continue;}
  let line=m[1];
  for(const t of tags.reverse())line=line.slice(0,t.start-m.index)+line.slice(t.end-m.index);
  line=line.replace(/^[\t ]+|[\t ]+$/g,'');
  if(line)body.push(line+m[2]);
 }
 const remaining=body.join('');
 return tokens.map(t=>t.tag).join(' ')+(remaining?'\n'+remaining:'');
}
