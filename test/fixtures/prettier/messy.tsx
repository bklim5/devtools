type Props={label:string,n:number}
const Tag=({label,n}:Props):JSX.Element=><span title={label}>{n as number}</span>
function List<T,>(props:{items:T[]}){return <ul>{props.items.map((it,i)=><li key={i}>{String(it)}</li>)}</ul>}
const el:JSX.Element=<Tag label="x" n={1} />
