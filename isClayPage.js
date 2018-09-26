function isClayPage() {
  return !!document.querySelector('html').getAttribute('data-uri');
}

isClayPage();
