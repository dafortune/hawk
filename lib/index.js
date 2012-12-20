// Load modules

var Crypto = require('crypto');
var URL = require('url');
var Err = require('./error');


// Declare internals

var internals = {};


// Hawk authentication

/*
 * credentialsFunc    - required function to lookup the set of Hawk credentials based on the provided credentials id.
 *                      The credentials include the MAC key, MAC algorithm, and other attributes (such as username)
 *                      needed by the application. This function is the equivalent of verifying the username and
 *                      password in Basic authentication.
 *
 *                      var credentialsFunc = function (id, callback) {
 *  
 *                          // Lookup credentials in database
 *                          db.lookup(id, function (err, item) {
 *  
 *                              if (err || !item) {
 *                                  return callback(err);
 *                              }
 *  
 *                              var credentials = {
 *                                  // Required
 *                                  key: item.key,
 *                                  algorithm: item.algorithm,
 *                                  // Application specific
 *                                  user: item.user
 *                              };
 *  
 *                              return callback(null, credentials);
 *                          });
 *                      };
 *
 * Options:
 * 
 * hostHeaderName    - optional header field name, used to override the default 'Host' header when used
 *                      behind a cache of a proxy. Apache2 changes the value of the 'Host' header while preserving
 *                      the original (which is what the module must verify) in the 'x-forwarded-host' header field.
 */

exports.authenticate = function (req, credentialsFunc, arg1, arg2) {

    var callback = (arg2 ? arg2 : arg1);
    var options = (arg2 ? arg1 : {});

    // Check required HTTP headers: host, authentication

    var hostHeader = (options.hostHeaderName ? req.headers[options.hostHeaderName.toLowerCase()] : req.headers.host);
    if (!hostHeader) {
        return callback(Err.badRequest('Missing Host header'), null, null);
    }

    var url = URL.parse(req.url, true);

    if (!req.headers.authorization && !url.query.hawk) {
        return callback(Err.unauthorized('Missing Authorization header'), null, null);
    }

    // Parse HTTP Authorization header

    var attributes = exports.parseHeader(req.headers.authorization || url.query.hawk);

    // Verify authentication scheme

    if (attributes instanceof Error) {
        return callback(attributes, null, null);
    }

    // Verify required header attributes

    if (!attributes.id ||
        !attributes.ts ||
        !attributes.mac) {

        return callback(Err.badRequest('Missing attributes'), null, attributes.ext);
    }

    // Obtain host and port information

    var hostHeaderRegex = /^(?:(?:\r\n)?[\t ])*([^:]+)(?::(\d+))?(?:(?:\r\n)?[\t ])*$/; // Does not support IPv6
    var hostParts = hostHeader.match(hostHeaderRegex);

    if (!hostParts ||
        hostParts.length !== 3 ||
        !hostParts[1]) {

        return callback(Err.badRequest('Bad Host header'), null, attributes.ext);
    }

    var host = hostParts[1];
    var port = (hostParts[2] ? hostParts[2] : (req.connection && req.connection.encrypted ? 443 : 80));

    // Fetch Hawk credentials

    credentialsFunc(attributes.id, function (err, credentials) {

        if (err) {
            return callback(err, credentials || null, attributes.ext);
        }

        if (!credentials) {
            return callback(Err.unauthorized('Missing credentials'), null, attributes.ext);
        }

        if (!credentials.key ||
            !credentials.algorithm) {

            return callback(Err.internal('Invalid credentials'), credentials, attributes.ext);
        }

        if (['hmac-sha-1', 'hmac-sha-256'].indexOf(credentials.algorithm) === -1) {
            return callback(Err.internal('Unknown algorithm'), credentials, attributes.ext);
        }

        // Calculate MAC
        var urlToCheck;
        if(url.query.hawk){
            delete url.query.hawk;
            delete url.search;
            urlToCheck = URL.format(url);
        }else{
            urlToCheck = req.url;
        }

        var mac = exports.calculateMAC(credentials.key, credentials.algorithm, attributes.ts, req.method, urlToCheck, host, port, attributes.ext);
        if (mac !== attributes.mac) {
            return callback(Err.unauthorized('Bad mac'), credentials, attributes.ext);
        }

        // Successful authentication

        return callback(null, credentials, attributes.ext);
    });
};


// Calculate the request MAC

exports.calculateMAC = function (key, algorithm, timestamp, method, uri, host, port, ext) {

    // Parse request URI

    var url = URL.parse(uri);

    // Construct normalized req string

    var normalized = timestamp + '\n' +
                     method.toUpperCase() + '\n' +
                     url.pathname + (url.search || '') + '\n' +
                     host.toLowerCase() + '\n' +
                     port + '\n' +
                     (ext || '') + '\n';

    // Lookup hash function

    var hashMethod = '';
    switch (algorithm) {

        case 'hmac-sha-1': hashMethod = 'sha1'; break;
        case 'hmac-sha-256': hashMethod = 'sha256'; break;
        default: return '';
    }

    // MAC normalized req string

    var hmac = Crypto.createHmac(hashMethod, key).update(normalized);
    var digest = hmac.digest('base64');
    return digest;
};


// Extract attribute from MAC header (strict)

exports.parseHeader = function (header) {

    var headerRegex = /^([Hh][Aa][Ww][Kk])(?:\s+(.*))?$/;
    var headerParts = header.match(headerRegex);

    if (!headerParts) {
        return Err.unauthorized('Incorrect scheme');
    }

    if (!headerParts[2]) {
        return Err.badRequest('Invalid header format');
    }

    var attributes = {};

    var attributesRegex = /(id|ts|ext|mac)="([^"\\]*)"\s*(?:,\s*|$)/g;
    var verify = headerParts[2].replace(attributesRegex, function ($0, $1, $2) {

        if (attributes[$1] === undefined) {
            attributes[$1] = $2;
            return '';
        }
    });

    if (verify !== '') {
        return Err.badRequest('Unknown attributes');
    }
    
    return attributes;
};


// Generate an Authorization header for a given request

/*
 * credentials is an object with the following keys: 'id, 'key', 'algorithm'.
 */

exports.getAuthorizationHeader = function (credentials, method, uri, host, port, ext, timestamp) {

    // Check request

    if (!credentials.id ||
        !credentials.key ||
        !credentials.algorithm) {

        // Invalid credential object
        return '';
    }

    // Calculate signature

    timestamp = timestamp || Math.floor(((new Date()).getTime() / 1000));
    var mac = exports.calculateMAC(credentials.key, credentials.algorithm, timestamp, method, uri, host, port, ext);

    if (!mac) {
        return '';
    }

    // Construct header

    var header = 'Hawk id="' + credentials.id + '", ts="' + timestamp + (ext ? '", ext="' + ext : '') + '", mac="' + mac + '"';
    return header;
};

