# 🚀 Esdent Gold - Render.com Deployment Rehberi

Bu rehber, Esdent Gold hasta yönetim sistemini **tamamen ücretsiz** olarak Render.com'da nasıl yayınlayacağınızı adım adım açıklar.

## 📋 Gereksinimler

1. GitHub hesabı (ücretsiz)
2. Render.com hesabı (ücretsiz)
3. MongoDB Atlas hesabı (ücretsiz)

---

## 🎯 Adım 1: MongoDB Atlas Kurulumu (Ücretsiz Veritabanı)

### 1.1. MongoDB Atlas'a Kaydolun
1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)'a gidin
2. Ücretsiz hesap oluşturun (Google ile giriş yapabilirsiniz)

### 1.2. Ücretsiz Cluster Oluşturun
1. "Create a Deployment" butonuna tıklayın
2. **M0 (Free)** seçeneğini seçin
3. Provider: **AWS** seçin
4. Region: **Frankfurt** (veya size yakın olan)
5. Cluster Name: `esdent-gold`
6. "Create" butonuna tıklayın (2-3 dakika sürer)

### 1.3. Database User Oluşturun
1. Sol menüden **"Database Access"** seçin
2. "Add New Database User" butonuna tıklayın
3. Username: `esdent_user`
4. Password: **Güçlü bir şifre** oluşturun (kaydedin!)
5. Database User Privileges: **"Read and write to any database"**
6. "Add User" butonuna tıklayın

### 1.4. Network Access Ayarları
1. Sol menüden **"Network Access"** seçin
2. "Add IP Address" butonuna tıklayın
3. **"Allow Access from Anywhere"** seçin (0.0.0.0/0)
4. "Confirm" butonuna tıklayın

### 1.5. Connection String'i Alın
1. Sol menüden **"Database"** seçin
2. Cluster'ınızın yanında **"Connect"** butonuna tıklayın
3. **"Drivers"** seçeneğini seçin
4. Connection string'i kopyalayın:
   ```
   mongodb+srv://esdent_user:<password>@esdent-gold.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. `<password>` kısmını kendi şifrenizle değiştirin
6. Bu string'i bir yere kaydedin! ⚠️

---

## 🎯 Adım 2: GitHub'a Yükleme

### 2.1. GitHub'da Yeni Repo Oluşturun
1. [GitHub](https://github.com/new)'a gidin
2. Repository name: `esdent-gold`
3. **Public** seçin (ücretsiz deployment için gerekli)
4. "Create repository" butonuna tıklayın

### 2.2. Kodları GitHub'a Yükleyin

**Yöntem 1: GitHub Web Arayüzü (Kolay)**
1. Bu projedeki tüm dosyaları ZIP olarak indirin
2. ZIP'i açın
3. GitHub repo sayfasında "Add file" → "Upload files"
4. Tüm dosyaları sürükleyip bırakın
5. "Commit changes" butonuna tıklayın

**Yöntem 2: Git Komut Satırı (İleri Seviye)**
```bash
# Proje klasöründe
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/esdent-gold.git
git push -u origin main
```

---

## 🎯 Adım 3: Render.com'da Deployment

### 3.1. Render.com'a Kaydolun
1. [Render.com](https://render.com)'a gidin
2. "Get Started for Free" butonuna tıklayın
3. GitHub ile giriş yapın

### 3.2. Backend Service Oluşturun

1. Dashboard'da **"New +"** butonuna tıklayın
2. **"Web Service"** seçin
3. GitHub repo'nuzu bulun ve **"Connect"** butonuna tıklayın
4. Ayarları yapın:
   - **Name**: `esdent-gold-backend`
   - **Region**: `Frankfurt`
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: **Free** seçin

5. **Environment Variables** bölümüne gidin:
   - Key: `MONGO_URL`, Value: (MongoDB Atlas connection string'inizi yapıştırın)
   - Key: `DB_NAME`, Value: `esdent_gold`

6. **"Create Web Service"** butonuna tıklayın
7. Deploy işlemi başlayacak (5-10 dakika sürer)
8. ✅ Deploy tamamlandığında size bir URL verilecek: `https://esdent-gold-backend.onrender.com`

### 3.3. Frontend Service Oluşturun

1. Dashboard'da tekrar **"New +"** → **"Static Site"** seçin
2. GitHub repo'nuzu seçin
3. Ayarları yapın:
   - **Name**: `esdent-gold-frontend`
   - **Branch**: `main`
   - **Root Directory**: `frontend`
   - **Build Command**: `yarn install && yarn build`
   - **Publish Directory**: `build`

4. **Environment Variables**:
   - Key: `REACT_APP_BACKEND_URL`
   - Value: `https://esdent-gold-backend.onrender.com` (backend URL'nizi yapıştırın)

5. **"Create Static Site"** butonuna tıklayın
6. Deploy işlemi başlayacak (3-5 dakika)
7. ✅ Deploy tamamlandığında frontend URL'niz hazır!

---

## 🎉 TAMAMLANDI!

Artık uygulamanız canlı ve kullanıma hazır:

- **Frontend URL**: `https://esdent-gold-frontend.onrender.com`
- **Backend URL**: `https://esdent-gold-backend.onrender.com`

### 🔗 Kalıcı Link Özellikleri

✅ **Tamamen ücretsiz**
✅ **Kalıcı URL** - Kaybolmaz
✅ **HTTPS** otomatik aktif
✅ **24/7 çalışır**
✅ **Otomatik güncellemeler** (GitHub'a push yaptığınızda)

---

## ⚠️ Önemli Notlar

### Ücretsiz Plan Kısıtlamaları

**Render.com Ücretsiz Plan:**
- Web services 750 saat/ay (yeterli)
- 15 dakika aktivite yoksa uyku moduna geçer
- İlk istek 30-60 saniye sürebilir (soğuk başlatma)
- Static siteler sınırsız

**MongoDB Atlas Ücretsiz Plan:**
- 512 MB depolama (yeterli)
- Sınırsız bağlantı

### İpuçları

1. **Soğuk Başlatma**: İlk açılış yavaş olabilir, sonraki istekler hızlı
2. **Aktif Tutma**: Uygulamayı düzenli kullanın veya uptime monitor kullanın
3. **Yedekleme**: MongoDB Atlas otomatik yedekleme yapar
4. **Güncelleme**: GitHub'a yeni kod push ettiğinizde otomatik deploy olur

---

## 🆘 Sorun Giderme

### Backend Çalışmıyor
- Render dashboard'da logs'u kontrol edin
- MONGO_URL doğru mu?
- Environment variables kaydedildi mi?

### Frontend Backend'e Bağlanamıyor
- REACT_APP_BACKEND_URL doğru mu?
- Backend URL'de `/api` prefix'i var mı?
- Frontend'i yeniden deploy edin

### MongoDB Bağlantı Hatası
- IP whitelist'e 0.0.0.0/0 eklenmiş mi?
- Database user şifresi doğru mu?
- Connection string'de `<password>` değiştirilmiş mi?

---

## 📞 Destek

Sorun yaşarsanız:
1. Render.com logs'ları kontrol edin
2. MongoDB Atlas logs'ları kontrol edin
3. Browser console'da hata var mı bakın

**Başarılar! 🎊**
