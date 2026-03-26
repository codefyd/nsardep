function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('مجمع كذا')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}
