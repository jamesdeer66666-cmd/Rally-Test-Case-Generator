const sanitizeUI = text => {
      let out = text;
      out = out.replace(/Log in.*(?:\n|$)/gi, 'Authenticate using API token\n');
      out = out.replace(/Navigate to.*(?:\n|$)/gi, 'Send appropriate API request\n');
      out = out.replace(/Click .*?(?:\.|\n)/gi, 'Send API request accordingly.\n');
      out = out.replace(/select \*\*([^*]+)\*\*/gi, 'set "$1" field via API');
      out = out.replace(/screen/gi, 'API endpoint');
      out = out.replace(/form/gi, 'JSON payload');
      out = out.replace(/UI/gi, 'API');
      return out;
    };

const sample = `1. Log in as a user with policy-creation rights.
2. Navigate to Create New Policy -> select Carrier: Hanover -> LOB: BOP.
3. Fill in all mandatory policy fields except the loss-question section.
4. Click Save.
`;
console.log('Original:\n'+sample);
console.log('Sanitized:\n'+sanitizeUI(sample));
