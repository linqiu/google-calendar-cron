var grunt = require('grunt');
grunt.loadNpmTasks('grunt-aws-lambda');
grunt.loadNpmTasks('grunt-contrib-clean');

grunt.initConfig({
    lambda_invoke: {
        default: {
        }
    },
    lambda_package: {
        default: {
        }
    },
    clean: {
        build: ['dist/*.zip']
    }
});

grunt.registerTask('build', ['clean', 'lambda_package']);