// src/services/dependencyService.ts

export interface Dependency {
  id: string;
  name: string;
}

let dependencies: Dependency[] = [
  { id:"d1", name:"React"},
  { id:"d2", name:"Node"},
  { id:"d3", name:"Docker"},
  { id:"d4", name:"Redis"},
];

/* ======================================================

const API="/api/dependencies";

export async function apiGetDependencies(){
  return fetch(API).then(r=>r.json());
}

export async function apiCreateDependency(payload){
  return fetch(API,{
    method:"POST",
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  }).then(r=>r.json());
}

export async function apiDeleteDependency(id){
  return fetch(`${API}/${id}`,{method:"DELETE"});
}

====================================================== */

export function getDependencies(): Dependency[] {
  return [...dependencies];
}

export function createDependency(name:string){
  dependencies.push({
    id: crypto.randomUUID(),
    name
  })
}

export function deleteDependency(id:string){
  dependencies = dependencies.filter(d => d.id !== id);
}
