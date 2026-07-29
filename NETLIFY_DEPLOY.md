# Netlify Deploy

## ახალი demo build

Terminal-ში გაუშვი:

```bash
npm.cmd run deploy:prep
```

ეს ბრძანება:

1. ატარებს TypeScript შემოწმებას.
2. ქმნის production build-ს.
3. ამზადებს `NETLIFY_UPLOAD_THIS` ფოლდერს.

## Netlify-ზე ასატვირთი ფოლდერი

ატვირთე ეს ფოლდერი:

```text
NETLIFY_UPLOAD_THIS
```

ფოლდერის შიგნით root-ში უნდა იყოს:

```text
index.html
_redirects
asset-manifest.json
static
```

ფაილების არჩევის ფანჯარაში თუ მხოლოდ `static` ჩანს, ეს ნორმალურია: Windows folder picker
ფაილებს არ აჩვენებს. არ შეხვიდე `static`-ში. მონიშნე თვითონ `NETLIFY_UPLOAD_THIS`
ან მიმდინარე ფოლდერზე დააჭირე `Upload`.
