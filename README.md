# Bütçe Takip

Lovable ile başlatılan, React, TypeScript, Vite ve Supabase kullanan kişisel bütçe uygulaması.

## Yerel geliştirme

```powershell
npm install
npm run dev
```

Uygulama için `.env` dosyasında aşağıdaki değerler gerekir:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

`.env` Git tarafından izlenmez.

## Lovable ve Supabase sürekliliği

Bu kod tabanı, Lovable projesinden gelen `kcxwifrqwgzzzamraqge` Supabase
projesini kullanır. Aynı `VITE_SUPABASE_URL` ve
`VITE_SUPABASE_PUBLISHABLE_KEY` değerleri korunduğu sürece mevcut kullanıcılar,
profiller, ayarlar ve işlemler aynı veritabanından yüklenir; ayrıca bir kullanıcı
veya işlem aktarımı yapılmaz.

Canlıya çıkmadan önce Supabase panelinde bu proje kimliğinin kendi hesabında
göründüğünü doğrula ve bir veritabanı yedeği al. Proje paneline erişim yoksa yeni
bir Supabase projesine geçme: anonim anahtar kullanıcı parolalarını veya Auth
kayıtlarını eksiksiz dışa aktarmaya yetmez; önce proje sahipliği çözülmelidir.

## Kontroller

```powershell
npm run lint
npm exec tsc -- --noEmit -p tsconfig.app.json
npm run test
npm run build
```

## Git

Bu bilgisayarda taşınabilir Git `.tools/mingit` altında bulunur ve Git tarafından izlenmez:

```powershell
& '.\.tools\mingit\cmd\git.exe' status
```

Sisteme Git kurulduğunda standart `git` komutu da kullanılabilir.
