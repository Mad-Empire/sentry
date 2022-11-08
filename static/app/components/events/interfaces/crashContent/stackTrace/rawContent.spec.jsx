import displayRawContent, {
  getJavaFrame,
  getJavaPreamble,
} from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';

describe('RawStacktraceContent', function () {
  describe('getJavaFrame()', function () {
    it('should render java frames', function () {
      expect(
        getJavaFrame({
          module: 'org.mortbay.thread.QueuedThreadPool$PoolThread',
          function: 'run',
          filename: 'QueuedThreadPool.java',
          lineNo: 582,
        })
      ).toEqual(
        '    at org.mortbay.thread.QueuedThreadPool$PoolThread.run(QueuedThreadPool.java:582)'
      );

      // without line number
      expect(
        getJavaFrame({
          module: 'org.mortbay.thread.QueuedThreadPool$PoolThread',
          function: 'run',
          filename: 'QueuedThreadPool.java',
        })
      ).toEqual(
        '    at org.mortbay.thread.QueuedThreadPool$PoolThread.run(QueuedThreadPool.java)'
      );

      // without line number and filename
      expect(
        getJavaFrame({
          module: 'org.mortbay.thread.QueuedThreadPool$PoolThread',
          function: 'run',
        })
      ).toEqual('    at org.mortbay.thread.QueuedThreadPool$PoolThread.run');
    });
  });

  describe('getJavaPreamble()', function () {
    it('takes a type and value', () => {
      expect(
        getJavaPreamble({
          type: 'Baz',
          value: 'message',
        })
      ).toEqual('Baz: message');
    });

    it('takes a module name', () => {
      expect(
        getJavaPreamble({
          module: 'foo.bar',
          type: 'Baz',
          value: 'message',
        })
      ).toEqual('foo.bar.Baz: message');
    });
  });

  describe('render()', function () {
    const exception = {
        module: 'example.application',
        type: 'Error',
        value: 'an error occurred',
      },
      data = {
        frames: [
          {
            function: 'main',
            module: 'example.application',
            lineNo: 1,
            filename: 'application',
          },
          {
            function: 'doThing',
            module: 'example.application',
            lineNo: 2,
            filename: 'application',
          },
        ],
      };

    it('renders java example', () => {
      expect(displayRawContent(data, 'java', exception)).toEqual(
        `example.application.Error: an error occurred
    at example.application.doThing(application:2)
    at example.application.main(application:1)`
      );
    });

    it('renders python example', () => {
      expect(displayRawContent(data, 'python', exception)).toEqual(
        `Error: an error occurred
  File "application", line 1, in main
  File "application", line 2, in doThing`
      );
    });
  });
});
