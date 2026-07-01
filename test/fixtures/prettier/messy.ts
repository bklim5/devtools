type ID=string|number
interface User{id:ID,name:string,tags:string[]}
const u:User={id:1,name:"ada",tags:["x","y"]}
function greet(user:User):string{return "hi "+user.name}
const ids:ID[]=[1,"two",3]
