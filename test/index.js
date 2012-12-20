// Load modules

var Chai = require('chai');
var Hawk = process.env.TEST_COV ? require('../lib-cov') : require('../lib');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Hawk', function () {

    var credentialsFunc = function (id, callback) {

        var credentials = {
            id: id,
            key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
            algorithm: (id === '1' ? 'hmac-sha-1' : 'hmac-sha-256'),
            user: 'steve'
        };

        return callback(null, credentials);
    };

    it('should generate a header then successfully parse it', function (done) {

        var req = {
            headers: {
                host: 'example.com:8080'
            },
            method: 'GET',
            url: '/resource/4?filter=a'
        };

        credentialsFunc('123456', function (err, credentials) {

            req.headers.authorization = Hawk.getAuthorizationHeader(credentials, req.method, req.url, 'example.com', 8080, 'some-app-data', 1353809207);

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {

                expect(err).to.not.exist;
                expect(credentials.user).to.equal('steve');
                expect(ext).to.equal('some-app-data');
                done();
            });
        });
    });

    it('should generate a header for one resource then fail to authenticate another', function (done) {

        var req = {
            headers: {
                host: 'example.com:8080'
            },
            method: 'GET',
            url: '/resource/4?filter=a'
        };

        credentialsFunc('123456', function (err, credentials) {

            req.headers.authorization = Hawk.getAuthorizationHeader(credentials, req.method, req.url, 'example.com', 8080, 'some-app-data', 1353809207);
            req.url = '/something/else';

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(credentials).to.exist;
                done();
            });
        });
    });

    describe('#authenticate', function () {

        it('should parse a valid authentication header (hmac-sha-1)', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="1", ts="1353788437", mac="lDdDLlWQhgcxTvYgzzLo3EZExog=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {

                expect(err).to.not.exist;
                expect(credentials.user).to.equal('steve');
                done();
            });
        });

        it('should parse a valid authentication header (hmac-sha-256)', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {

                expect(err).to.not.exist;
                expect(credentials.user).to.equal('steve');
                done();
            });
        });

        it('should parse a valid authentication header in query string', function (done) {

            var req = {
                headers: {
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a&hawk=' + encodeURIComponent('Hawk id="123", ts="1353788437", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"')
            };

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {
                if(err) return done(err);
                expect(credentials.user).to.equal('steve');
                done();
            });
        });

        it('should fail on an invalid authentication header: wrong scheme', function (done) {

            var req = {
                headers: {
                    authorization: 'Basic asdasdasdasd',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Incorrect scheme');
                done();
            });
        });

        it('should fail on an missing authorization header', function (done) {

            var req = {
                headers: {
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Missing Authorization header');
                done();
            });
        });

        it('should fail on an missing host header', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Missing Host header');
                done();
            });
        });

        it('should fail on an missing authorization attribute', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk ts="1353788437", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Missing attributes');
                done();
            });
        });

        it('should fail on an unknown authorization attribute', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", x="3", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Unknown attributes');
                done();
            });
        });

        it('should fail on an invalid authorization header format', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Invalid header format');
                done();
            });
        });

        it('should fail on an bad host header', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080:90'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Bad Host header');
                done();
            });
        });

        it('should fail on credentialsFunc error', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            var credentialsFunc = function (id, callback) {

                return callback(new Error('Unknown user'));
            };

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.message).to.equal('Unknown user');
                done();
            });
        });

        it('should fail on missing credentials', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            var credentialsFunc = function (id, callback) {

                return callback(null, null);
            };

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Missing credentials');
                done();
            });
        });

        it('should fail on invalid credentials', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            var credentialsFunc = function (id, callback) {

                var credentials = {
                    key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
                    user: 'steve'
                };

                return callback(null, credentials);
            };

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.message).to.equal('Invalid credentials');
                expect(err.toResponse().payload.message).to.equal('An internal server error occurred');
                done();
            });
        });

        it('should fail on unknown credentials algorithm', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            var credentialsFunc = function (id, callback) {

                var credentials = {
                    key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
                    algorithm: 'hmac-sha-0',
                    user: 'steve'
                };

                return callback(null, credentials);
            };

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.message).to.equal('Unknown algorithm');
                expect(err.toResponse().payload.message).to.equal('An internal server error occurred');
                done();
            });
        });

        it('should fail on unknown bad mac', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", mac="/qwS4UjfVWMcU4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            var credentialsFunc = function (id, callback) {

                var credentials = {
                    key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
                    algorithm: 'hmac-sha-256',
                    user: 'steve'
                };

                return callback(null, credentials);
            };

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Bad mac');
                done();
            });
        });
    });

    describe('#calculateMAC', function () {

        it('should return an empty value on unknown algorithm', function (done) {

            expect(Hawk.calculateMAC('dasdfasdf', 'hmac-sha-0', Date.now() / 1000, 'GET', '/resource/something', 'example.com', 8080)).to.equal('');
            done();
        });
    });

    describe('#getAuthorizationHeader', function () {

        it('should return a valid authorization header', function (done) {

            var credentials = {
                id: '123456',
                key: '2983d45yun89q',
                algorithm: 'hmac-sha-256'
            };

            var header = Hawk.getAuthorizationHeader(credentials, 'POST', '/somewhere/over/the/rainbow', 'example.net', 443, 'Bazinga!', 1353809207);
            expect(header).to.equal('Hawk id="123456", ts="1353809207", ext="Bazinga!", mac="LYUkYKYkQsQstqNQHcnAzDXce0oHsmS049rv4EalMb8="');
            done();
        });

        it('should return an empty authorization header on invalid credentials', function (done) {

            var credentials = {
                key: '2983d45yun89q',
                algorithm: 'hmac-sha-256'
            };

            var header = Hawk.getAuthorizationHeader(credentials, 'POST', '/somewhere/over/the/rainbow', 'example.net', 443, 'Bazinga!', 1353809207);
            expect(header).to.equal('');
            done();
        });

        it('should return an empty authorization header on invalid algorithm', function (done) {

            var credentials = {
                id: '123456',
                key: '2983d45yun89q',
                algorithm: 'hmac-sha-0'
            };

            var header = Hawk.getAuthorizationHeader(credentials, 'POST', '/somewhere/over/the/rainbow', 'example.net', 443, 'Bazinga!', 1353809207);
            expect(header).to.equal('');
            done();
        });
    });
});

