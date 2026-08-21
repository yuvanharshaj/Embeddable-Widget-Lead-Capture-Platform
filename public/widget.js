(function() {
  const currentScript = document.currentScript;
  const scriptUrl = new URL(currentScript.src);
  const widgetId = scriptUrl.searchParams.get('id');
  const baseUrl = scriptUrl.origin;

  if (!widgetId) {
    console.error('Widget ID is required');
    return;
  }

  // Create a container
  const container = document.createElement('div');
  container.id = \`widget-container-\${widgetId}\`;
  currentScript.parentNode.insertBefore(container, currentScript.nextSibling);

  // Fetch config
  fetch(\`\${baseUrl}/widgets/\${widgetId}/config\`)
    .then(res => res.json())
    .then(config => {
      if (config.error) {
        console.error('Widget error:', config.error);
        return;
      }
      renderWidget(config);
    })
    .catch(err => console.error('Failed to load widget config', err));

  function renderWidget(config) {
    const form = document.createElement('form');
    form.style.border = '1px solid #ccc';
    form.style.padding = '20px';
    form.style.maxWidth = '300px';
    form.style.fontFamily = 'sans-serif';

    const title = document.createElement('h3');
    title.innerText = config.title || 'Subscribe';
    form.appendChild(title);

    if (config.description) {
      const desc = document.createElement('p');
      desc.innerText = config.description;
      form.appendChild(desc);
    }

    const fields = config.fields || [{ name: 'email', label: 'Email', type: 'email' }];
    fields.forEach(field => {
      const label = document.createElement('label');
      label.innerText = field.label;
      label.style.display = 'block';
      label.style.marginBottom = '5px';
      
      const input = document.createElement('input');
      input.type = field.type;
      input.name = field.name;
      input.required = true;
      input.style.width = '100%';
      input.style.marginBottom = '15px';
      input.style.boxSizing = 'border-box';
      
      label.appendChild(input);
      form.appendChild(label);
    });

    // Honeypot field (hidden)
    const honeypotDiv = document.createElement('div');
    honeypotDiv.style.display = 'none';
    const honeypotInput = document.createElement('input');
    honeypotInput.type = 'text';
    honeypotInput.name = '_honeypot';
    honeypotInput.tabIndex = -1;
    honeypotInput.autocomplete = 'off';
    honeypotDiv.appendChild(honeypotInput);
    form.appendChild(honeypotDiv);

    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.innerText = config.button_text || 'Submit';
    btn.style.width = '100%';
    btn.style.padding = '10px';
    btn.style.backgroundColor = '#0070f3';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    form.appendChild(btn);

    const msg = document.createElement('p');
    msg.style.display = 'none';
    form.appendChild(msg);

    form.onsubmit = (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = {};
      let honeypot = '';
      formData.forEach((value, key) => {
        if (key === '_honeypot') {
          honeypot = value;
        } else {
          data[key] = value;
        }
      });

      btn.disabled = true;
      btn.innerText = 'Submitting...';

      fetch(\`\${baseUrl}/submissions\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          widget_id: widgetId,
          data: data,
          _honeypot: honeypot
        })
      })
      .then(async res => {
        const result = await res.json();
        if (res.ok) {
          form.reset();
          msg.innerText = 'Thank you for your submission!';
          msg.style.color = 'green';
        } else {
          msg.innerText = result.error || 'Something went wrong.';
          msg.style.color = 'red';
        }
        msg.style.display = 'block';
        btn.disabled = false;
        btn.innerText = config.button_text || 'Submit';
      })
      .catch(err => {
        msg.innerText = 'Network error. Please try again.';
        msg.style.color = 'red';
        msg.style.display = 'block';
        btn.disabled = false;
        btn.innerText = config.button_text || 'Submit';
      });
    };

    container.appendChild(form);
  }
})();
