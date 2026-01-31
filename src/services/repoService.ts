// src/services/repoService.ts

export interface Repo {
  id: string;
  name: string;
  url: string;
}

let repos: Repo[] = [
  {
    id: "r1",
    name: "Frontend",
    url: "https://github.com/demo/frontend"
  },
  {
    id: "r2",
    name: "Backend",
    url: "https://github.com/demo/backend"
  }
];

/* ======================================================
   BACKEND API INTEGRATION (DO NOT DELETE)

const API="/api/repos";

export async function apiGetRepos(){
  return fetch(API).then(r=>r.json());
}

export async function apiCreateRepo(payload){
  return fetch(API,{
    method:"POST",
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  }).then(r=>r.json());
}

export async function apiDeleteRepo(id){
  return fetch(`${API}/${id}`,{method:"DELETE"});
}

====================================================== */

export function getRepos(): Repo[] {
  return [...repos];
}

export function createRepo(name:string,url:string){
  repos.push({
    id: crypto.randomUUID(),
    name,
    url
  });
}

export function deleteRepo(id:string){
  repos= repos.filter(r=>r.id!==id);
}
