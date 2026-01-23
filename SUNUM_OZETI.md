# 🚀 Teklif AI - Proje Durum ve Özellik Raporu

Bu belge, **Teklif AI** projesinin mevcut yeteneklerini, çalışan özelliklerini ve geliştirilmekte olan gelecek adımlarını özetler. Müşteri sunumlarında kullanılmak üzere hazırlanmıştır.

---

## 🟢 Aktif ve Çalışan Özellikler (Demo Hazır)

Şu anda sistem üzerinde canlı olarak test edilebilecek ve kullanılabilen özellikler:

### 1. 🤖 Yapay Zeka Destekli Teklif İşleme (AI PDF Parsing)
*   **PDF Yükleme:** Temsilciler sahadayken PDF formatındaki teklifleri sisteme yükleyebilir.
*   **Otomatik Veri Çıkarma:** Google Gemini (AI) motoru, PDF içeriğini okur ve şunları otomatik ayıklar:
    *   Müşteri Adı
    *   Teklif Tutarı ve Para Birimi
    *   Teklif Bölümü/Konusu (Havuz, Solar, Klima vb.)
    *   İşin Tanımı
*   **Sıfır Manuel Giriş:** Temsilcinin tek tek form doldurmasına gerek kalmaz, sadece PDF yükler ve AI her şeyi veritabanına işler.

### 2. 📅 Akıllı Takip ve Hatırlatma Sistemi (YENİ)
*   **Takip Planlama:** Her teklif için "Gelecek Takip Tarihi" belirleme (Yarın, 1 Hafta, 1 Ay vb.).
*   **Otomatik Durum Yönetimi:**
    *   **Yeşil:** Planlandı.
    *   **Turuncu:** Bugün aramanız gerekiyor (Günü geldi).
    *   **Kırmızı (Yanıp Sönen):** Gecikti! Zamanında arama yapılmadı.
*   **Performans Takibi:** Sistem, hangi temsilcinin kaç teklifi zamanında takip ettiğini, kaçını kaçırdığını arka planda sayar.

### 3. 📱 Mobil Uyumlu ve PWA (Progressive Web App)
*   **Her Cihazda Çalışır:** iOS ve Android telefonlarda, tabletlerde ve bilgisayarlarda kusursuz çalışır.
*   **Uygulama Gibi Kurulum:** "Ana Ekrana Ekle" özelliği ile telefona uygulama gibi yüklenir, tarayıcı barı olmadan tam ekran çalışır.
*   **Mobil Navigasyon:** Telefondan girildiğinde altta beliren kolay menü ile tek elle kullanım sağlar.

### 4. 👥 Rol Tabanlı Yetkilendirme (Güvenlik)
*   **Admin Paneli:** Şirket sahibi tüm temsilcileri, tüm teklifleri ve genel ciroyu görür.
*   **Temsilci Paneli:** Temsilciler **sadece kendi tekliflerini** görür ve düzenler. Başkasının verisine erişemez (RLS - Row Level Security).

### 5. 📊 Anlık İstatistikler ve Yönetim
*   Toplam Teklif Sayısı, Onaylananlar, Bekleyenler anlık olarak panoda görüntülenir.
*   Teklif durumu değiştirme (Taslak -> Gönderildi -> Onaylandı -> İptal).
*   PDF dosyasını sistem üzerinden direkt görüntüleme.

---

## 🟡 Geliştirme Aşamasında (Sırada)

Gelecek sürümde (v1.1) eklenecek özellikler:

1.  **📈 Detaylı Performans Grafikleri:** Temsilcilerin aylık satış başarı oranı, takip disiplini grafikleri.
2.  **🔔 Push Bildirimleri:** Takip günü geldiğinde telefona bildirim gönderme (Uygulama kapalıyken bile).
3.  **💬 AI Chat Asistanı:** "Geçen ay en çok klima teklifi kime verdik?" gibi sorulara doğal dilde cevap veren chatbot.
4.  **📧 Otomatik E-posta:** Müşteriye teklif onaylandığında veya temsilciye hatırlatma için otomatik mail gönderimi.

---

## 📝 Teknik Özet (IT Departmanı İçin)
*   **Altyapı:** Next.js (Web), React Native (Opsiyonel Mobile), Supabase (PostgreSQL Database).
*   **AI Motoru:** Google Gemini 1.5/2.0
*   **Sunucu:** Vercel (Frontend), Supabase Edge Functions (Backend Logic).
*   **Güvenlik:** Row Level Security (RLS) ile banka düzeyinde veri izolasyonu.
