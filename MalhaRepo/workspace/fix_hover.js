const fs = require('fs');
const file = 'src/components/GridOps.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replaceAll("group-hover:bg-slate-50'", "group-hover:bg-slate-100'");
data = data.replaceAll('group-hover:bg-slate-50}', 'group-hover:bg-slate-100}');
data = data.replaceAll("group-hover:bg-slate-50 ", "group-hover:bg-slate-100 ");

data = data.replaceAll('hover:bg-slate-50}', 'hover:bg-slate-100}');
data = data.replaceAll("hover:bg-slate-50'", "hover:bg-slate-100'");
data = data.replaceAll("hover:bg-slate-50 ", "hover:bg-slate-100 ");

fs.writeFileSync(file, data);
