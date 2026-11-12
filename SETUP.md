# Hướng dẫn cài đặt Abroad (bản chạy thật) — từng bước

Không có backend, app chạy ở **chế độ demo** (dữ liệu mẫu, lưu trên trình duyệt). Làm hết các bước dưới đây thì app chạy **thật 100%**:

| Tính năng | Cần gì |
|---|---|
| Đăng nhập bằng Google | Supabase + Google OAuth (Bước 1–5) |
| Onboarding (thành phố, trường, ngày ở, sở thích) lưu lên server | Database (Bước 2) |
| Life Admin, lịch import, feed iCal lưu theo tài khoản | Database (Bước 2) |
| Community (meetup, chuyến đi) dùng chung, cập nhật tức thì | Database + Realtime (Bước 2) |
| Google Calendar hai chiều (lịch học, deadline…) | Google Calendar API + hàm `google-token` (Bước 3, 6) |
| Smart Email (đọc Gmail thật, tự chia nhóm) | Gmail API + hàm `google-token` (Bước 3, 6) |
| Theo dõi link iCal thời khoá biểu của trường | Hàm `ical-proxy` (Bước 6) |
| **AI Companion** (chat AI thật, biết thành phố, checklist, lịch của bạn) | Hàm `ai-chat` + API key Anthropic (Bước 6, 7) |

**Thời gian:** khoảng 45–60 phút. **Chi phí:** Supabase và Google miễn phí. AI tốn khoảng 1–3 cent mỗi câu hỏi (nạp tối thiểu 5 USD là dùng được rất lâu).

> Mẹo: mở một file ghi chú trống để dán các giá trị bạn sẽ copy (Project URL, anon key, Client ID, Client secret, API key). Đừng gửi các giá trị **secret** cho ai, đừng commit lên GitHub.

---

## Danh sách file bạn sẽ dùng

| File | Dùng ở đâu |
|---|---|
| `supabase/SETUP_DATABASE.sql` | Bước 2: dán vào **SQL Editor** (tạo toàn bộ bảng, bảo mật, realtime) |
| `supabase/seed.sql` | Bước 2 (không bắt buộc): vài meetup/chuyến đi mẫu |
| `supabase/functions/google-token/index.ts` | Bước 6: dán vào hàm `google-token` |
| `supabase/functions/ical-proxy/index.ts` | Bước 6: dán vào hàm `ical-proxy` |
| `supabase/functions/ai-chat/index.ts` | Bước 6: dán vào hàm `ai-chat` |
| `.env.example` → `.env` | Bước 8: điền URL và anon key |

Mỗi file hàm là **một file duy nhất**, copy nguyên văn là chạy, không cần cài gì thêm.

---

## Bước 1 — Tạo project Supabase mới

Org "Bach Institut" của bạn đang ở gói Free, cho phép **2 project đang chạy**. Bạn đã có `bach-institut`, nên tạo thêm 1 project nữa là vừa.

1. Vào https://supabase.com/dashboard → chọn org **Bach Institut** → **New project**.
2. Điền:
   - **Project name:** `abroad`
   - **Database password:** bấm **Generate a password** → copy lưu lại (ít khi cần, nhưng đừng mất).
   - **Region:** `Central EU (Frankfurt)` (gần Berlin/Madrid/Lisbon nhất).
3. Bấm **Create new project** → đợi 1–2 phút cho project khởi động xong.
4. Lấy 2 giá trị cho app:
   - Bấm **Connect** (nút trên cùng) hoặc vào **Project Settings → API Keys**.
   - Copy **Project URL**, dạng `https://abcdefghijkl.supabase.co`. Phần `abcdefghijkl` gọi là **project ref**, sẽ dùng nhiều lần.
   - Mở tab **Legacy API Keys** → copy khoá **`anon` `public`** (chuỗi dài bắt đầu bằng `eyJ...`).
   - **KHÔNG** copy khoá `service_role`. Khoá đó là bí mật, app không cần.

---

## Bước 2 — Tạo database (1 lần dán)

1. Trong project `abroad` → menu trái **SQL Editor** → **New query** (dấu +).
2. Mở file `supabase/SETUP_DATABASE.sql` trong project, **chọn tất cả (Cmd+A) → copy**, dán vào ô query.
3. Bấm **Run** (hoặc Cmd+Enter). Kết quả phải là `Success. No rows returned`.
   - Nếu Supabase hỏi *"This query has destructive operations"* thì bấm **Run this query** (file chỉ tạo bảng mới).
4. Kiểm tra: menu trái **Table Editor** → phải thấy các bảng `profiles`, `task_progress`, `user_events`, `ical_feeds`, `meetups`, `meetup_rsvps`, `trips`, `trip_members`, `waitlist`, `google_tokens`, `ai_messages`.
5. *(Không bắt buộc)* Muốn Community có sẵn vài meetup và chuyến đi mẫu: **New query** → dán `supabase/seed.sql` → **Run**.

> File này chỉ chạy **một lần** trên project mới. Chạy lại lần 2 sẽ báo lỗi `policy ... already exists`. Lỗi đó vô hại: database đã có rồi.

---

## Bước 3 — Google Cloud: project, API, màn hình đồng ý

Bạn đã làm cái này cho project trước, lần này làm y hệt nhưng **thêm Calendar và Gmail**.

### 3.1 Tạo project
1. Vào https://console.cloud.google.com → thanh trên cùng bấm chọn project → **New Project**.
2. **Project name:** `Abroad` → **Create** → đợi xong rồi **chọn project Abroad** ở thanh trên cùng (rất hay quên bước này).

### 3.2 Bật 2 API
1. Menu ☰ → **APIs & Services → Library**.
2. Tìm **Google Calendar API** → bấm vào → **Enable**.
3. Quay lại Library, tìm **Gmail API** → **Enable**.

### 3.3 Màn hình đồng ý (Google Auth Platform)
Menu ☰ → **Google Auth Platform** (hoặc **APIs & Services → OAuth consent screen**). Nếu chưa cấu hình, bấm **Get started**:

1. **App Information:** App name `Abroad`, User support email = email của bạn → **Next**.
2. **Audience:** chọn **External** → **Next**.
3. **Contact information:** email của bạn → **Next** → tích đồng ý chính sách → **Create**.

Sau đó trong Google Auth Platform:

4. **Branding** (menu trái):
   - **Authorized domains** → **Add domain** → `supabase.co`.
   - Sau khi có link app (Bước 9), thêm luôn domain đó (vd. `vercel.app` hoặc `lovable.app`).
   - **Save**.
5. **Audience** (menu trái):
   - Publishing status giữ **Testing**. Đừng bấm "Publish app".
   - **Test users → Add users** → thêm email Gmail của: bạn, các bạn cùng nhóm, **thầy/cô** (tối đa 100) → **Save**.
   - Chỉ những email này đăng nhập được.
6. **Data Access** (menu trái) → **Add or remove scopes**:
   - Ô lọc gõ `calendar` → tích `.../auth/calendar`.
   - Gõ `gmail.readonly` → tích `.../auth/gmail.readonly`.
   - (`email`, `profile`, `openid` có sẵn hoặc tích thêm cũng được.)
   - **Update** → **Save**.

> Vì sao để **Testing**: Gmail là quyền "restricted". Nếu publish, Google bắt kiểm tra bảo mật trả phí. Ở chế độ Testing thì không cần, chỉ có 2 điều:
> - Lúc đăng nhập sẽ hiện *"Google hasn't verified this app"* → bấm **Continue**.
> - Phiên Google hết hạn sau **7 ngày**. Khi Calendar/Gmail báo lỗi kết nối thì **Sign out → Sign in** lại là xong.

---

## Bước 4 — Google: tạo OAuth Client

1. Google Auth Platform → **Clients** → **Create client** (hoặc APIs & Services → Credentials → Create credentials → OAuth client ID).
2. **Application type:** `Web application`. **Name:** `Abroad Supabase`.
3. **Authorized JavaScript origins:** bỏ trống cũng được.
4. **Authorized redirect URIs → Add URI:**
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
   Thay `<project-ref>` bằng mã ở Bước 1, vd. `https://abcdefghijkl.supabase.co/auth/v1/callback`. Phải khớp **từng ký tự**: `https`, không có dấu `/` ở cuối.
5. **Create** → hiện **Client ID** và **Client secret** → copy cả 2.
   - Bản mới của Google chỉ hiện secret **một lần**. Lỡ mất thì vào client đó → **Add secret** để tạo cái mới.

---

## Bước 5 — Nối Google vào Supabase

1. Supabase → **Authentication** → **Sign In / Providers** (hoặc **Providers**) → **Google**:
   - Bật **Enable Sign in with Google**.
   - Dán **Client ID** và **Client Secret** từ Bước 4.
   - Các ô khác để nguyên → **Save**.
2. Supabase → **Authentication → URL Configuration**:
   - **Site URL:** tạm điền `http://localhost:8080`. Sau Bước 9 đổi thành link app thật.
   - **Redirect URLs → Add URL**, thêm từng cái:
     - `http://localhost:8080/**`
     - (sau Bước 9) `https://<link-app-của-bạn>/**`
   - **Save**.

---

## Bước 6 — Đưa 3 edge function lên (dán code trên web, không cần cài gì)

Làm **3 lần**, mỗi lần cho một hàm. **Tên hàm phải đúng chính xác**, vì app gọi theo tên.

| Tên hàm | File để copy |
|---|---|
| `google-token` | `supabase/functions/google-token/index.ts` |
| `ical-proxy` | `supabase/functions/ical-proxy/index.ts` |
| `ai-chat` | `supabase/functions/ai-chat/index.ts` |

Cách làm cho mỗi hàm:
1. Supabase → menu trái **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Editor mở sẵn 1 file `index.ts` có code mẫu → **xoá hết** → dán toàn bộ nội dung file tương ứng ở bảng trên.
3. Ở ô **Function name** (góc dưới) đổi tên thành đúng tên trong bảng (vd. `google-token`).
4. Bấm **Deploy function** → đợi báo thành công.
5. Vào trang chi tiết của hàm → tab **Details** (hoặc **Settings**): **TẮT** công tắc **Verify JWT with legacy secret** / "Enforce JWT verification" → **Save**. Hàm tự kiểm tra người đăng nhập bên trong code; để bật thì project Supabase mới sẽ báo lỗi 401.

Xong 3 hàm, trang Edge Functions phải có đủ `google-token`, `ical-proxy`, `ai-chat`.

### Thêm secret cho hàm
Supabase → **Edge Functions → Secrets** (hoặc Project Settings → Edge Functions) → **Add new secret**, thêm 3 cái:

| Name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID ở Bước 4 |
| `GOOGLE_CLIENT_SECRET` | Client secret ở Bước 4 |
| `ANTHROPIC_API_KEY` | Key ở Bước 7 (làm Bước 7 xong quay lại thêm) |

Bấm **Save**. Các biến `SUPABASE_URL`, `SUPABASE_ANON_KEY` và `SUPABASE_SERVICE_ROLE_KEY` Supabase tự có sẵn, **không** cần thêm.

---

## Bước 7 — API key cho AI Companion (Claude)

AI Companion dùng **Claude Opus 5.5** của Anthropic. Mỗi câu hỏi, app gửi kèm thông tin của bạn để câu trả lời sát thực tế: thành phố, trường, ngày ở, checklist còn thiếu và 12 sự kiện sắp tới. App còn bật **fallback phía server**: nếu Claude từ chối một câu, Anthropic tự thử lại bằng model dự phòng.

1. Vào https://console.anthropic.com → đăng ký hoặc đăng nhập.
2. **Settings → Billing** → nạp credit (tối thiểu 5 USD; mỗi câu khoảng 1–3 cent).
3. **Settings → API Keys** → **Create Key** → đặt tên `abroad` → copy key (dạng `sk-ant-...`, chỉ hiện 1 lần).
4. Quay lại Supabase → **Edge Functions → Secrets** → thêm `ANTHROPIC_API_KEY` = key vừa copy.

Giới hạn có sẵn trong code (`supabase/functions/ai-chat/index.ts`, đầu file):
- `DAILY_LIMIT = 30` câu mỗi người mỗi ngày, để không ai đốt hết credit.
- `HISTORY = 20` tin nhắn gần nhất được nhớ.

Muốn đổi thì sửa số rồi deploy lại hàm. Bạn cũng có thể đặt **giới hạn chi tiêu hàng tháng** trong console Anthropic (**Settings → Limits**).

---

## Bước 8 — Điền `.env` và chạy thử ở máy

1. Trong thư mục `abroad-app`, copy `.env.example` thành `.env`:
   ```bash
   cp .env.example .env
   ```
2. Mở `.env`, thay 2 dòng bằng giá trị ở Bước 1:
   ```
   VITE_SUPABASE_URL=https://abcdefghijkl.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...   (khoá anon public)
   ```
   2 giá trị này **được phép công khai**: chúng nằm trong code trình duyệt, còn dữ liệu đã được Row Level Security bảo vệ.
3. Chạy:
   ```bash
   npm install
   ```
   ```bash
   npm run dev
   ```
   Mở http://localhost:8080.

### Danh sách thử (làm theo thứ tự)
1. **Đăng nhập:** Home có banner "Sign in with Google" → bấm → chọn tài khoản (phải nằm trong Test users) → "Google hasn't verified this app" → **Continue** → **Continue**.
2. **Onboarding:** app hỏi 3 bước (thành phố → trường + ngày → tên + sở thích) → **Finish setup**. Kiểm tra trong Supabase → Table Editor → `profiles` có 1 dòng.
3. **Life Admin:** tích vài việc → F5 lại trang, các việc đã tích vẫn còn (bảng `task_progress`).
4. **Lịch học (iCal):** Calendar → **Import** → tải file `.ics` thời khoá biểu, hoặc dán link iCal của trường (link `webcal://` hay `https://...ics`) → sự kiện hiện trên lịch.
5. **Google Calendar:** Settings → bật **Google Calendar** → Google hỏi quyền xem/sửa lịch → **Continue** → Calendar → **Sync Google**. Lịch Google của bạn hiện trong app, và trong Google Calendar có thêm lịch tên **"Abroad"**.
6. **Smart Email:** Settings → bật **Smart Email** → cho phép đọc Gmail → hộp thư hiện thư thật, đã chia University / Visa / Housing.
7. **AI Companion:** Home → ô "Type your question…" → hỏi vd. *"Tuần này mình cần làm gì?"* → mở trang chat, vài giây sau có câu trả lời. Kiểm tra bảng `ai_messages`.
8. **Community:** Explore → **Host a meetup** hoặc **Post a trip** → mở app bằng tài khoản thứ 2 (cửa sổ ẩn danh) để thấy cập nhật tức thì.

---

## Bước 9 — Đưa lên GitHub và chạy online

### 9.1 Đẩy code lên GitHub
1. Vào https://github.com/new → tên repo `abroad-app` → **Private** hoặc Public tuỳ bạn → **Create repository** (đừng tích thêm README).
2. Trong thư mục `abroad-app` (đã có sẵn git và commit):
   ```bash
   git remote add origin https://github.com/<tên-github>/abroad-app.git
   ```
   ```bash
   git push -u origin main
   ```
   *(Nếu nhánh tên `master` thì thay `main` bằng `master`.)*

> `.env` đã nằm trong `.gitignore` nên **không** bị đẩy lên GitHub. Hosting nhận 2 biến này qua phần cài đặt bên dưới.

### 9.2 Cách A — Vercel (chắc chắn chạy, miễn phí)
1. https://vercel.com → đăng nhập bằng GitHub → **Add New → Project** → chọn repo `abroad-app` → **Import**.
2. Framework tự nhận **Vite**. Mở **Environment Variables**, thêm:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = anon key
3. **Deploy** → được link dạng `https://abroad-app-xxx.vercel.app`.
4. Để mở thẳng `/calendar`, `/assistant`… không bị 404: repo đã có sẵn file `vercel.json`, không cần làm gì thêm.

### 9.3 Cách B — Lovable
Tài liệu chính thức của Lovable nói không import được repo GitHub có sẵn (Lovable luôn tạo repo mới). Trang FAQ thì lại hướng dẫn chọn repo có sẵn khi tạo project. Cứ thử trước:
1. Lovable → project mới → **GitHub** → xem có cho chọn repo `abroad-app` không.
2. Nếu được: trong Lovable, thêm 2 biến `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY`. Nếu Lovable không có chỗ nhập biến, bạn có thể ép commit file `.env` (`git add -f .env` → commit → push): 2 giá trị này công khai được, nhưng **tuyệt đối không** để secret nào khác trong `.env`.
3. **Đừng** bấm "Connect Supabase"/"Lovable Cloud" để tạo database mới. App đã có Supabase riêng ở Bước 1.
4. Nếu không import được thì dùng Cách A (Vercel). Sau này muốn thêm tính năng bằng Lovable, có thể nhờ Lovable làm trên một project mới rồi copy phần cần sang.

### 9.4 Cập nhật link thật ở 2 chỗ (bắt buộc)
Có link app (vd. `https://abroad-app-xxx.vercel.app`) rồi thì:
1. **Supabase → Authentication → URL Configuration:**
   - **Site URL** = link app.
   - **Redirect URLs** thêm `https://abroad-app-xxx.vercel.app/**`.
2. **Google Auth Platform → Branding → Authorized domains:** thêm `vercel.app` (hoặc `lovable.app`).

Mở link app → đăng nhập → làm lại danh sách thử ở Bước 8.

---

## Lỗi thường gặp

| Hiện tượng | Nguyên nhân / Cách sửa |
|---|---|
| `Error 403: access_denied` khi đăng nhập | Email chưa có trong **Test users** (Bước 3.3 mục 5) |
| `Error 400: redirect_uri_mismatch` | Redirect URI ở Bước 4 sai. Phải đúng `https://<ref>.supabase.co/auth/v1/callback` |
| Đăng nhập xong quay về `localhost` dù đang dùng link online | Chưa đổi **Site URL** / chưa thêm **Redirect URLs** (Bước 9.4) |
| `Unsupported provider: provider is not enabled` | Chưa bật Google trong Supabase (Bước 5) |
| App vẫn ở "Demo mode (no backend connected)" | Thiếu `.env`, hoặc chưa đặt biến môi trường trên Vercel/Lovable. Sửa xong phải **chạy lại** `npm run dev` hoặc **Redeploy** |
| "No Google connection — please sign in with Google again" | Hàm `google-token` chưa deploy, hoặc thiếu secret `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Sửa xong → Sign out → Sign in |
| Calendar/Gmail báo lỗi `invalid_grant` sau 1 tuần | Phiên Google ở chế độ Testing hết hạn sau 7 ngày → Sign out → Sign in |
| "Gmail API has not been used in project…" | Chưa bật Gmail API / Calendar API (Bước 3.2), hoặc bật nhầm project |
| AI: "AI is not set up yet (missing ANTHROPIC_API_KEY secret)" | Thêm secret ở Bước 7 |
| AI: "ANTHROPIC_API_KEY is invalid" | Key sai hoặc đã xoá → tạo key mới |
| AI: lỗi 400 nhắc tới *credit balance* | Tài khoản Anthropic hết tiền → nạp thêm |
| AI: "Daily limit reached" | Đã hỏi 30 câu hôm nay. Đổi `DAILY_LIMIT` trong `ai-chat` rồi deploy lại nếu cần |
| `Failed to send a request to the Edge Function` | Tên hàm sai (phải đúng `ai-chat`, `google-token`, `ical-proxy`) hoặc chưa deploy |
| Gọi hàm bị 401 | Chưa tắt **Verify JWT** của hàm (Bước 6, mục 5), hoặc phiên hết hạn → đăng nhập lại |
| Community trống | Bình thường khi mới tạo. Chạy `seed.sql` hoặc tự tạo meetup đầu tiên |
| SQL báo `already exists` | File đã chạy rồi, database đã có, bỏ qua |

**Xem log lỗi:** Supabase → Edge Functions → chọn hàm → tab **Logs**. Trên trình duyệt: F12 → **Console**.

---

## Bảo mật (đọc 1 lần)

- Mọi bảng đều bật **Row Level Security**: mỗi người chỉ đọc và sửa dữ liệu của chính mình. Meetup và chuyến đi thì ai đăng nhập cũng xem được, nhưng chỉ người tạo mới xoá được.
- **Refresh token Google** và **lịch sử chat AI** chỉ hàm trên server mới ghi được. Trình duyệt không đọc được token Google.
- `GOOGLE_CLIENT_SECRET` và `ANTHROPIC_API_KEY` chỉ nằm trong **Secrets của Supabase**, không bao giờ để trong code, `.env` hay GitHub.
- Khi **Sign out**, app thu hồi luôn quyền Google.
- App chỉ **đọc** Gmail (`gmail.readonly`), không gửi hay xoá thư.
- Người dùng có thể xoá toàn bộ lịch sử chat bằng nút **Clear** trên trang AI Companion.
