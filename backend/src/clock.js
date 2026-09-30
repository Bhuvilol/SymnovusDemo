let timeProvider = () => Date.now();

export function now() {
  return timeProvider();
}

export function setTimeProvider(provider) {
  if (typeof provider !== 'function') {
    throw new TypeError('Time provider must be a function.');
  }

  timeProvider = provider;
}

export function resetTimeProvider() {
  timeProvider = () => Date.now();
}
