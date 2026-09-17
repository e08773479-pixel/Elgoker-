const C=window.MALAK_CONFIG;
const ready=C.SUPABASE_URL.startsWith("http") && !C.SUPABASE_ANON_KEY.includes("YOUR_");
const sb=ready?supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY):null;
let user=null, profile=null, currentChat=null, realtime=null, registerMode=false;

const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const avatar=u=>u?.avatar_url||`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(u?.display_name||"Malak")}`;
function toast(t){$("toast").textContent=t;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2600)}
function status(t){$("authStatus").textContent=t}
function requireDB(){if(!sb){toast("أكمل ربط Supabase في js/config.js أولاً");return false}return true}

async function boot(){
  if(!sb){$("authScreen").classList.remove("hidden");$("appScreen").classList.add("hidden");status("المشروع جاهز — اربط Supabase من js/config.js لتفعيل الحسابات والبيانات الحقيقية.");return}
  const {data}=await sb.auth.getSession(); if(data.session) await enter(data.session.user);
  sb.auth.onAuthStateChange(async(e,s)=>{if(e==="SIGNED_IN"&&s) await enter(s.user); if(e==="SIGNED_OUT") location.reload()});
}
async function enter(u){
  user=u;
  const {data:p}=await sb.from("profiles").select("*").eq("id",u.id).single();
  profile=p||{id:u.id,display_name:u.email?.split("@")[0]||"عضو جديد",avatar_url:null,bio:""};
  $("authScreen").classList.add("hidden");$("appScreen").classList.remove("hidden");
  $("topAvatar").src=avatar(profile);$("composerAvatar").src=avatar(profile);
  $("sideProfile").innerHTML=`<div class="side-profile"><img class="avatar" src="${avatar(profile)}"><b>${esc(profile.display_name)}</b><small class="muted">${esc(profile.bio||"عضو في Malak")}</small></div>`;
  $("setName").value=profile.display_name||"";$("setBio").value=profile.bio||"";
  await loadHome(); await loadSuggestions(); await loadConversations();
  sb.channel("malak-live").on("postgres_changes",{event:"*",schema:"public",table:"messages"},()=>loadConversations()).subscribe();
}
async function loadHome(){await loadStories();await loadFeed("feed");await loadOnline()}
async function loadStories(){
  const {data}=await sb.from("stories").select("*,profiles:author_id(id,display_name,avatar_url)").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(20);
  $("stories").innerHTML=`<button class="story add" id="addStory">＋<span>إضافة قصة</span></button>`+(data||[]).map(s=>`<button class="story" data-story="${s.id}"><img src="${esc(s.media_url)}"><span>${esc(s.profiles?.display_name)}</span></button>`).join("");
  $("addStory").onclick=()=>storyModal();
}
async function loadFeed(target){
  const {data,error}=await sb.from("posts").select("*,profiles:author_id(id,display_name,avatar_url),likes(user_id),comments(count)").order("created_at",{ascending:false}).limit(50);
  if(error){$(target).innerHTML=`<div class="card post">${esc(error.message)}</div>`;return}
  $(target).innerHTML=(data||[]).map(postCard).join("")||`<div class="card post"><p class="muted">لا توجد منشورات حتى الآن.</p></div>`;
  (data||[]).forEach(p=>{const b=document.querySelector(`[data-like="${p.id}"]`);if(b)b.onclick=()=>toggleLike(p.id,p.likes?.some(x=>x.user_id===user.id));});
}
function postCard(p){
  const liked=p.likes?.some(x=>x.user_id===user.id), count=p.likes?.length||0;
  const media=p.media_url?(p.media_type==="video"?`<video class="post-media" src="${esc(p.media_url)}" controls></video>`:`<img class="post-media" src="${esc(p.media_url)}">`):"";
  return `<article class="card post"><div class="post-head"><img src="${avatar(p.profiles)}"><div><b>${esc(p.profiles?.display_name||"عضو")}</b><small>${new Date(p.created_at).toLocaleString("ar-EG")}</small></div><button class="more">•••</button></div><p class="post-text">${esc(p.body)}</p>${media}<div class="post-stats"><span>${count} إعجاب</span><span>${p.comments?.[0]?.count||0} تعليق</span></div><div class="post-buttons"><button class="${liked?"liked":""}" data-like="${p.id}">♥ إعجاب</button><button onclick="commentPost('${p.id}')">💬 تعليق</button><button onclick="sharePost('${p.id}')">↗ مشاركة</button></div></article>`;
}
async function toggleLike(postId,liked){
  if(liked) await sb.from("likes").delete().eq("post_id",postId).eq("user_id",user.id);
  else await sb.from("likes").insert({post_id:postId,user_id:user.id});
  await loadFeed("feed");
}
window.commentPost=async id=>{const body=prompt("اكتب تعليقك");if(!body)return;await sb.from("comments").insert({post_id:id,user_id:user.id,body});await loadFeed("feed")}
window.sharePost=async id=>{await sb.from("shares").insert({post_id:id,user_id:user.id});toast("تم تسجيل المشاركة")}
async function publish(){
  const body=$("postText").value.trim(), img=$("postImage").files[0], vid=$("postVideo").files[0];
  if(!body&&!img&&!vid)return toast("اكتب شيئًا أو اختر صورة/فيديو");
  let media_url=null,media_type=null,file=img||vid;
  if(file){
    const path=`${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g,"_")}`;
    const {error}=await sb.storage.from("media").upload(path,file,{upsert:false});
    if(error)return toast("فشل رفع الملف: "+error.message);
    media_url=sb.storage.from("media").getPublicUrl(path).data.publicUrl;media_type=vid?"video":"image";
  }
  const {error}=await sb.from("posts").insert({author_id:user.id,body,media_url,media_type,visibility:$("postVisibility").value});
  if(error)return toast(error.message);
  $("postText").value="";$("postImage").value="";$("postVideo").value="";toast("تم نشر المنشور");await loadFeed("feed");
}
async function loadSuggestions(){
  const {data}=await sb.from("profiles").select("*").neq("id",user.id).limit(10);
  $("suggestions").innerHTML=(data||[]).map(p=>`<div class="person mini-row"><img src="${avatar(p)}"><div><b>${esc(p.display_name)}</b><button class="primary small" onclick="follow('${p.id}')">متابعة</button></div></div>`).join("");
  $("friendsGrid").innerHTML=(data||[]).map(p=>`<div class="card person"><img src="${avatar(p)}"><h3>${esc(p.display_name)}</h3><p>${esc(p.bio||"عضو في Malak")}</p><button class="primary" onclick="follow('${p.id}')">متابعة</button></div>`).join("");
}
window.follow=async id=>{const {error}=await sb.from("follows").upsert({follower_id:user.id,following_id:id});toast(error?error.message:"تمت المتابعة")}
async function loadOnline(){const {data}=await sb.from("profiles").select("*").eq("is_online",true).neq("id",user.id).limit(8);$("onlineUsers").innerHTML=(data||[]).map(p=>`<div class="mini-row"><img class="avatar" src="${avatar(p)}"><b>${esc(p.display_name)}</b></div>`).join("")}
async function loadConversations(){
  const {data}=await sb.from("conversations").select("id,created_at,conversation_members!inner(user_id,profiles:user_id(id,display_name,avatar_url))").eq("conversation_members.user_id",user.id).order("created_at",{ascending:false});
  $("conversationList").innerHTML=(data||[]).map(c=>{const other=c.conversation_members.find(m=>m.user_id!==user.id)?.profiles;return `<button class="conv" onclick="openChat('${c.id}','${esc(other?.id||"")}')"><img src="${avatar(other)}"><div><b>${esc(other?.display_name||"محادثة")}</b><small>فتح المحادثة</small></div></button>`}).join("")||`<div class="empty">لا توجد محادثات</div>`;
}
window.openChat=async(cid,otherId)=>{
  currentChat={cid,otherId};$("pageMessages").querySelector(".messages-layout").classList.add("chat-open");
  const {data:other}=await sb.from("profiles").select("*").eq("id",otherId).single();
  const {data:msgs}=await sb.from("messages").select("*").eq("conversation_id",cid).order("created_at");
  $("chatPanel").innerHTML=`<div class="chat-head"><img src="${avatar(other)}"><b>${esc(other?.display_name||"مستخدم")}</b></div><div id="chatMessages" class="chat-messages">${(msgs||[]).map(m=>`<div class="bubble ${m.sender_id===user.id?"me":"them"}">${esc(m.body)}</div>`).join("")}</div><form id="chatForm" class="chat-input"><input id="chatText" placeholder="اكتب رسالة..." autocomplete="off"><button class="primary">إرسال</button></form>`;
  $("chatForm").onsubmit=async e=>{e.preventDefault();const body=$("chatText").value.trim();if(!body)return;await sb.from("messages").insert({conversation_id:cid,sender_id:user.id,body});$("chatText").value="";openChat(cid,otherId)};
}
async function storyModal(){ $("modalBody").innerHTML=`<h2>إضافة قصة</h2><input id="storyFile" type="file" accept="image/*,video/*"><button class="primary" id="saveStory">نشر القصة</button>`;$("modal").classList.remove("hidden");$("saveStory").onclick=async()=>{const f=$("storyFile").files[0];if(!f)return;const path=`stories/${user.id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]/g,"_")}`;const up=await sb.storage.from("media").upload(path,f);if(up.error)return toast(up.error.message);const url=sb.storage.from("media").getPublicUrl(path).data.publicUrl;await sb.from("stories").insert({author_id:user.id,media_url:url,media_type:f.type.startsWith("video")?"video":"image"});$("modal").classList.add("hidden");loadStories()}}
$("publishBtn").onclick=publish;
$("closeModal").onclick=()=>$("modal").classList.add("hidden");
$("mobileMenu").onclick=()=>$("sidebar").classList.toggle("open");
$("logoutBtn").onclick=async()=>{if(sb)await sb.auth.signOut()};
$("toggleRegister").onclick=()=>{registerMode=!registerMode;$("displayName").classList.toggle("register-only",!registerMode);$("authSubmit").textContent=registerMode?"إنشاء الحساب":"تسجيل الدخول";$("toggleRegister").textContent=registerMode?"لدي حساب بالفعل":"إنشاء حساب جديد"};
$("authForm").onsubmit=async e=>{e.preventDefault();if(!requireDB())return;const email=$("email").value.trim(),password=$("password").value; if(registerMode){const name=$("displayName").value.trim();if(!name)return status("اكتب اسمك");const {data,error}=await sb.auth.signUp({email,password,options:{data:{display_name:name}}});if(error)return status(error.message);if(!data.session)status("تم إنشاء الحساب. راجع بريدك إذا كان تأكيد البريد مفعلاً.");else toast("تم إنشاء الحساب");}else{const {error}=await sb.auth.signInWithPassword({email,password});if(error)status(error.message)}};
$("googleBtn").onclick=async()=>{if(!requireDB())return;const {error}=await sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+location.pathname}});if(error)status(error.message)};
$("phoneBtn").onclick=()=>status("لتفعيل الهاتف: فعّل Phone Auth في Supabase ثم نضيف شاشة OTP في الخطوة التالية.");
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
function showPage(p){document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));$("page"+p[0].toUpperCase()+p.slice(1)).classList.remove("hidden");document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.page===p));$("sidebar").classList.remove("open");if(p==="explore")loadFeed("exploreFeed");if(p==="profile")loadProfile();if(p==="groups")loadGroups()}
async function loadProfile(){const {data:posts}=await sb.from("posts").select("*,profiles:author_id(id,display_name,avatar_url),likes(user_id),comments(count)").eq("author_id",user.id).order("created_at",{ascending:false});$("profileView").innerHTML=`<div class="card profile-cover"><img class="avatar big" src="${avatar(profile)}"><h2>${esc(profile.display_name)}</h2><p>${esc(profile.bio||"")}</p><div class="profile-stats"><b>${posts?.length||0}<small> منشور</small></b></div></div><div id="myPosts" style="margin-top:15px">${(posts||[]).map(postCard).join("")}</div>`}
async function loadGroups(){const {data}=await sb.from("groups").select("*").order("created_at",{ascending:false});$("groupsGrid").innerHTML=(data||[]).map(g=>`<div class="card group"><img src="${g.cover_url||"https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=500&q=70"}"><h3>${esc(g.name)}</h3><p>${esc(g.description||"")}</p><button class="primary">عرض المجموعة</button></div>`).join("")}
$("saveProfile").onclick=async()=>{const name=$("setName").value.trim(),bio=$("setBio").value.trim();const {error}=await sb.from("profiles").update({display_name:name,bio}).eq("id",user.id);if(error)return toast(error.message);profile={...profile,display_name:name,bio};toast("تم حفظ الملف");enter(user)}
$("searchInput").oninput=async e=>{const q=e.target.value.trim();if(q.length<2)return;const {data}=await sb.from("profiles").select("*").ilike("display_name",`%${q}%`).limit(8);$("suggestions").innerHTML=(data||[]).map(p=>`<div class="mini-row"><img class="avatar" src="${avatar(p)}"><b>${esc(p.display_name)}</b></div>`).join("")}
boot();