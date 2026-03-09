# Covid-19 Vaccine Consent Form assets

Place the exact 2-page consent template images here:

- `covid-consent-p1.png`
- `covid-consent-p2.png`

Generate from the source PDF:

```bash
magick -density 200 "Covid Consent - Blank.pdf[0]" -quality 95 public/forms/covid-consent-p1.png
magick -density 200 "Covid Consent - Blank.pdf[1]" -quality 95 public/forms/covid-consent-p2.png
```

Or with poppler:

```bash
pdftoppm -png -r 200 "Covid Consent - Blank.pdf" public/forms/covid-consent
mv public/forms/covid-consent-1.png public/forms/covid-consent-p1.png
mv public/forms/covid-consent-2.png public/forms/covid-consent-p2.png
```
