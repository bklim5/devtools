const Btn=({label,onClick})=><button className="b"   onClick={onClick}>{label}</button>
function App(){const items=[1,2,3];return <ul>{items.map(n=><li key={n}>{n*2}</li>)}</ul>}
const x=<div id='a' data-x="y">hi{  ' ' }there</div>
